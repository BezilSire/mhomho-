# MHOMHO — Security Model

Date: 2026-10-24 (auth hardening pass: 2026-10-26)
Scope: the code in this repository, as built locally. **Nothing has been
deployed to production.** No third-party penetration test has been performed.

This document states what is enforced, where, and what remains open. If a control
is described as "tested", the test is in `tests/` and passes.

---

## 1. Threat model

| # | Threat | Primary control | Tested |
| --- | --- | --- | --- |
| T1 | Client edits balances/earnings/roles | Server recomputes everything from D1; client only renders | yes |
| T2 | Stolen database dump replays sessions | Only SHA-256 of session token stored | yes |
| T3 | Stolen DB dump cracks passwords | PBKDF2-SHA256, 210k iterations, per-account salt | yes |
| T4 | Cross-site request forgery | Origin allowlist + CSRF double-submit + SameSite=Lax | yes |
| T5 | Brute force / credential stuffing | D1 fixed-window limits per hashed IP **and** per hashed login identifier | yes |
| T6 | Privilege escalation via API | Role + status gates on every privileged route | yes |
| T7 | Budget over-commitment | Ledger trigger aborts; D1 batch rolls back | yes |
| T8 | Double payment of one clip | Partial unique index + status guard | yes |
| T9 | Replayed payout reference | Unique key + explicit pre-check → 409 | yes |
| T10 | SSRF via creator-supplied URL | URL is parsed, never fetched; host allowlist | yes |
| T11 | Malicious upload | Size cap, magic-byte sniff, server-generated key, private ACL | yes |
| T12 | SQL injection | Every query is parameterised; no string-built SQL from input | yes |
| T13 | Stored XSS via names/briefs | React escaping + strict CSP (`script-src 'self'`) | partial |
| T14 | PII leakage in public responses | Role-scoped projection; brand report has no identity | yes |
| T15 | Secret leakage in the bundle | No server secret is a `VITE_*` variable | yes |
| T16 | Information leak in errors | Generic 500 + request ID; details only for `ApiError` | yes |
| T17 | Abuse of expensive uploads | Per-account hourly upload limit | yes |
| T18 | Unauthorised proof image access | Visibility + owner/admin check before R2 read | yes |
| T19 | Forum spam or abusive posting | Approved-creator-only access, per-account rate limits, admin hide/lock and no HTML/attachments | yes |

## 2. Authentication

- **Password hashing**: PBKDF2-SHA256, 210,000 iterations, 256-bit output,
  16-byte random salt stored as lowercase hex. The salt **string bytes** are used
  on both creation and verification, so the two paths cannot diverge.
- **Password policy**: minimum 12 characters for creators and administrators,
  maximum 200. No composition rules (length is the meaningful control).
- **Timing**: unknown accounts run a dummy PBKDF2 derivation so that "no such
  user" and "wrong password" take comparable time. Login errors are deliberately
  identical for both cases.
- **Login identifiers**: creators may use email **or** `@handle`. Emails are
  matched on `email_normalized`; handles are matched only when the input is not
  an email. Administrators must use email.
- **First administrator**: `POST /api/setup/admin` hashes both the supplied and
  configured `ADMIN_SETUP_TOKEN`, then compares them in constant time (so the
  token length is not leaked), and refuses permanently once any `admin` row
  exists. Remove the secret after setup.
- **Session fixation**: a fresh opaque token is issued on every login; no
  pre-login token is reused.
- **Revocation**: logout sets `revoked_at`; `revokeAllSessions` bumps
  `session_version` and revokes every live session for the account.
- **Suspended accounts**: rejected at session read time, so suspension takes
  effect immediately even with a valid cookie.

## 3. Sessions and CSRF

| Property | Value |
| --- | --- |
| Cookie name | `mhomho_session` on HTTP dev; `__Host-mhomho_session` on HTTPS |
| Flags | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` on every HTTPS request (and whenever `ENVIRONMENT=production`) |
| Token | 32 random bytes, base64url, never stored in plaintext |
| Storage at rest | SHA-256 hex in `sessions.token_hash` |
| Creator TTL | 8 h (configurable, clamped 10 min–24 h) |
| Admin TTL | 30 min (configurable, clamped 5 min–1 h) |
| Idle tracking | `last_seen_at` touched at most once per minute |

CSRF is defended in three layers:

1. `SameSite=Lax` prevents the cookie riding along on cross-site POSTs.
2. `assertSameOrigin` rejects any mutation whose `Origin` header is not the
   configured `APP_ORIGIN` (a missing Origin is accepted for non-browser clients;
   browsers always send it on POST).
3. `assertCsrf` compares the `X-CSRF-Token` header with the session's stored
   token using a constant-time comparison.

The CSRF token is delivered only through `GET /api/bootstrap` and kept in memory.
Login, registration, enquiry and admin setup do not require CSRF (no session
exists yet) but do enforce Origin and rate limits.

Logout always requires a same-origin request; when a session exists it also
requires the CSRF token. Passwords changes and account deletion are additionally
rate-limited per account so a stolen session cannot brute-force the current
password.

## 4. Authorisation

- `requireAccount(ctx, roles)` — authenticated and, optionally, one of the roles.
- `requireAdmin(ctx)` — role `admin` **and** status `approved`.
- `requireCreator(ctx)` — role `creator`, rejects suspended.
- `requireApprovedCreator(ctx)` — additionally requires `approved`, used for
  joining, submitting and uploading.
- Community reads require an approved creator (or an approved admin for
  moderation). Writing threads and replies is approved-creator-only; admins
  cannot post as creators.
- Ownership checks are explicit: a creator can only read their own proof assets;
  an administrator can read any.

Authorisation is never inferred from the presence of an ID in the request. Every
handler loads the row and checks the actor against it.

## 5. Input handling

`worker/src/validation.ts` validates every JSON body against a declarative
schema:

- type (`string`, `int`, `email`, `boolean`, `array`), `required`, `min`/`max`,
  enum `values`, `nullable`;
- unknown keys are rejected, so a client cannot smuggle extra fields into an
  update;
- integers are range-checked (views ≤ 10,000,000,000; budgets ≤ $50,000; amounts
  bounded);
- JSON bodies are capped at 64 KiB (declared length **and** actual bytes).

URLs are validated by `worker/src/urls.ts`:

- HTTPS only;
- no embedded credentials;
- host must equal or be a subdomain of `tiktok.com`, `instagram.com`,
  `youtube.com`, `youtu.be`, `facebook.com`, `fb.watch`;
- tracking parameters stripped, remaining query sorted, trailing slash removed;
- a stable post identity is derived where the platform exposes one.

**No outbound request is ever made to a creator-supplied URL.** There is no
`fetch` in the URL path, so SSRF is structurally impossible rather than filtered.

## 6. Uploads

| Control | Implementation |
| --- | --- |
| Size | `Content-Length` and actual byte length ≤ `MAX_UPLOAD_BYTES` (default 5 MiB, max 10 MiB). |
| Type | PNG / JPEG / WebP detected from **magic bytes**; client `Content-Type` and filename ignored. |
| Key | Server-generated `proof/YYYY/MM/obj_<uuid>.<ext>`; no user input in the key; collisions impossible. |
| Overwrite | Keys are unique per upload; R2 `put` never targets an existing key. |
| Visibility | Proof assets are always `private`; a DB `CHECK` enforces it. |
| Read | `GET /api/assets/:id` requires owner or approved admin for private assets. |
| Response headers | `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: private, no-store`. |
| Rate limit | 30 uploads per account per hour. |
| Audit | `asset.upload` event with actor, type and size (not content). |

No antivirus/CDR pipeline exists. Images are served with a sandbox CSP and
`nosniff`, which limits the impact of a polyglot file, but this is not a
substitute for scanning.

## 7. Rate limits

Fixed-window counters in D1 (`rate_limits`), keyed by peppered IP hash or account
ID. D1 serialises writes, so the UPSERT is atomic.

| Bucket | Limit | Window |
| --- | --- | --- |
| `register:<ip>` | 5 | 1 h |
| `login:<ip>` | 20 | 15 min |
| `login-account:<sha256(identifier)>` | 30 | 15 min |
| `admin-login:<ip>` | 5 | 15 min |
| `admin-login-account:<sha256(email)>` | 10 | 15 min |
| `password-change:<account>` | 5 | 15 min |
| `account-delete:<account>` | 5 | 15 min |
| `enquiry:<ip>` | 5 | 1 h |
| `setup:<ip>` | 5 | 1 h |
| `upload:<account>` | 30 | 1 h |
| `forum:thread:<account>` | 5 | 1 h |
| `forum:reply:<account>` | 20 | 1 h |

Exceeding a limit returns `429` with `details.retryAfterSeconds`. A successful
sign-in clears that account's failure bucket. The per-account buckets mean a
distributed attacker can no longer bypass the IP limit to hammer one account;
they do not stop low-volume spraying across many different accounts. Cloudflare
WAF/rate limiting remains the right layer for that and is **not configured**.

## 8. Injection, XSS and headers

- **SQL**: every statement uses `.bind(...)`. No user value is interpolated into
  SQL. Dynamic fragments are limited to fixed placeholder lists and constant
  `WHERE` clauses built from server-side booleans.
- **XSS**: React escapes rendered strings. The static CSP is
  `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';
  form-action 'self'; frame-ancestors 'none'`, with Google Fonts allowed for
  styles/fonts and `img-src 'self' data: blob:`. `style-src` requires
  `'unsafe-inline'` because components use React `style` attributes.
- **DOM XSS**: there is no `dangerouslySetInnerHTML`, `eval`, `new Function`,
  `document.write` or string-based timer. The boot-error fallback builds nodes
  with `textContent`, so an exception message is never parsed as HTML. Creator
  post links are rendered only after validating the HTTPS host allowlist, and
  WhatsApp URLs use a fixed host with `encodeURIComponent` text.
- **Forum content**: threads and replies are plain text rendered as React text
  children (`white-space: pre-wrap`), not HTML or Markdown. URLs are not
  auto-linked and no attachment or preview fetcher exists.
- **Clickjacking**: `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
- **MIME sniffing**: `X-Content-Type-Options: nosniff` on assets and API.
- **Referrer leakage**: `strict-origin-when-cross-origin`.
- **Transport**: `Strict-Transport-Security: max-age=31536000` in production.
- **Cross-origin isolation**: `Cross-Origin-Opener-Policy: same-origin` and
  `X-Permitted-Cross-Domain-Policies: none`.
- **API caching**: `Cache-Control: no-store` on every JSON response.
- **CORS**: no `Access-Control-Allow-*` headers are ever emitted; `OPTIONS`
  returns `405`. The app is same-origin only.
- **Method handling**: the router matches exact method + path; a known path with
  the wrong method returns `405` with `Allow`, not a redirect.

Note: `public/_headers` applies to static assets only. API responses set their
own headers in `worker/src/index.ts`; the Worker does not emit a
`Content-Security-Policy` for JSON (it is not needed) but does emit `nosniff`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
`X-Permitted-Cross-Domain-Policies`, `Cross-Origin-Opener-Policy`, and HSTS in
production.

## 9. Secrets and configuration

- Server secrets (`ADMIN_SETUP_TOKEN`, `IP_PEPPER`, `ADMIN_PATH`) are Worker
  secrets, never `VITE_*`. The client bundle contains no build-time secrets.
- The client bundle contains no email, hash, salt, phone number or seed record.
  This was verified by searching the built bundle for the removed values.
- `.dev.vars` and `.wrangler/` are gitignored. A history scan found no committed
  secrets (only placeholders in `.env.example`).
- The operations-console shell is served by the Worker only at
  `/console/<ADMIN_PATH>`. `ADMIN_PATH` is a Worker secret, so the secret URL is
  not present in the client bundle; every other `/console/*` request is a 404.
  The response is `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`,
  and carries the full CSP. This hides the entry point, but it is not the
  authorisation boundary: every admin API still requires an admin session.
- Production JavaScript is minified and ships **no source maps**
  (`vite.config.ts`). Obfuscation is deliberately not used: a public client can
  always be inspected, and every authentication/authorisation decision is made
  in the Worker. Hiding endpoint names or JS structure would add size and
  breakage without adding a control.
- The Vite plugin writes a build-time `dist/mhomho/.dev.vars` containing local
  values. It is not deployed (`wrangler deploy` ignores `.dev.vars`), but it must
  not be published as a static asset; it lives outside `dist/client`.

## 10. PII and privacy

| Data | Where | Who can read it |
| --- | --- | --- |
| Email | `accounts` | the account, administrators |
| WhatsApp / EcoCash | `creator_profiles` | the creator, administrators |
| Proof screenshots | R2 + `campaign_assets` | owner, administrators |
| IP address | never stored | — |
| IP hash | sessions, audit, rate limits | administrators via DB only |
| Brand enquiry contact | `enquiries` | administrators |
| Public activity feed | `accounts.created_at`, `campaign_members.joined_at` | anonymous: first name + platform only; creators: + handle; admins: + account id |
| Community profile | `creator_profiles.handle`, `avatar_key`, `platform`, `niche` | approved creators and administrators; no email, phone, followers or balances |
| Forum content | `forum_threads`, `forum_replies` | approved creators see active content; administrators also see hidden content |

- Anonymous `/api/bootstrap` returns `creatorsPrivate = {}` and no submissions.
- `GET /api/activity` is the one deliberate exception to roster privacy. It is
  event-only, capped at the last 24 hours (the `since` cursor cannot walk
  further back), excludes rejected, suspended, deleted and anonymised accounts,
  and never exposes email, phone, followers, niche or balances. Anonymous
  callers receive a first name and platform; a handle is added only for a
  signed-in creator or administrator. `PUBLIC_ACTIVITY="false"` removes the
  feed for anonymous callers without a code change.
- Brand report tokens return aggregates only: no creator names, handles, emails
  or contact details. This is asserted by the E2E test.
- Payout destinations are stored masked for display; the raw number is not
  returned to the admin UI.
- Audit rows store hashed IPs, not addresses.

Residual: creators can self-delete (PII anonymised, sessions revoked, unpaid
balance written off), but there is no automated retention job for enquiries or
retained financial rows. Operator action is still required for those.

## 11. Financial integrity

Security here means "the numbers cannot be wrong or silently lost":

- the ledger is append-only at the database level;
- a positive campaign credit cannot exceed the pool (trigger);
- a creator balance cannot go negative (trigger);
- a payout allocation cannot exceed that creator's campaign credits (trigger);
- one live observation per submission (partial unique index);
- one open withdrawal per creator (partial unique index);
- payout references are globally unique and replays return `409`;
- a withdrawal reserves funds without a ledger row; only settlement writes the
  negative `payout` row, and cancellation releases the reservation;
- every verification stores observed, verified and eligible views plus the
  evidence note and administrator;
- budget exhaustion records `shortfall_cents` instead of dropping value;
- D1 `batch()` makes each multi-statement write atomic.

## 12. Logging and audit

`audit_events` records: creator approval, submission verify/reject, payout,
campaign create/top-up/status change, brand-token creation, enquiry status,
admin login, admin bootstrap, asset upload, forum thread/reply creation,
community moderation, and every automatic cron transition.
Each row carries actor, role, entity, before/after JSON, request ID and hashed IP.

Unhandled errors are logged with the request ID and returned to the client as a
generic `internal_error`; the ID lets an operator correlate the two.

No external log sink or alerting is configured. `observability` is enabled in
`wrangler.jsonc` at a 10 % head sampling rate.

## 13. Residual risk register

| Risk | Severity | Status / mitigation |
| --- | --- | --- |
| No production deployment or external pen test | High (process) | Explicitly out of scope until approval; see `DEPLOYMENT.md`. |
| No WAF / global rate limiting | Medium | D1 limits only; enable Cloudflare WAF before launch. |
| No second factor for administrator accounts | High | Password + 30-min session + per-IP/per-account limits only; add WebAuthn/passkeys or TOTP before scaling operations. |
| No antivirus on uploads | Medium | Magic-byte + size + sandbox CSP; add scanning if proofs become public. |
| No email verification / self-service reset | Medium | Admin-assisted reset; a compromised email cannot self-recover. |
| No post-approval correction endpoint | Medium | Ledger supports adjustments; correction is a manual D1 statement today. |
| `idempotency_keys` unused | Low | Domain keys cover all current writes. |
| No PII retention job | Medium | Manual erasure; document in the privacy notice. |
| Single-region D1 | Medium | Accept for launch; use D1 backups/exports. |
| Manual view verification is human | Medium | Evidence note + audit trail; spot-check administrators. |
| CSP allows `style-src 'unsafe-inline'` | Low | Required by React inline styles; no script relaxation. |
| Google Fonts is third-party | Low | Only `fonts.googleapis.com`/`fonts.gstatic.com` allowed; self-host to remove. |
| No CSRF token rotation | Low | Token lives with the session and dies with it. |
| Community has no report/block tooling | Medium | Approved-only access, rate limits and manual moderation; add reporting if volume grows. |

## 14. Reporting a vulnerability

Do not open a public issue for a security report. Contact the repository owner
privately with: affected endpoint, reproduction steps, impact, and whether data
or money is at risk. Do not test against production accounts or real payouts.
