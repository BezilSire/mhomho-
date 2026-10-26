# MHOMHO — Implemented Architecture

Date: 2026-10-26
Status: implemented and locally verified; **not deployed to production**.

This document describes what is in the repository now. The pre-change audit lives
in [`ARCHITECTURE-AUDIT.md`](./ARCHITECTURE-AUDIT.md); the data model is in
[`SCHEMA.md`](./SCHEMA.md); controls and residual risk are in
[`SECURITY.md`](./SECURITY.md); the release runbook is in
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 1. Shape of the system

One Cloudflare Worker serves both the API and the compiled SPA, from one origin.

```
Browser (React 19 SPA)
   │  same-origin fetch, HttpOnly session cookie, X-CSRF-Token header
   ▼
Cloudflare Worker  ── /api/*  ──►  Router ──► route handlers
   │                                   │
   │  everything else                  ├─► D1  (system of record)
   ▼                                   ├─► R2  (private proof + brand assets)
Static assets (dist/client)            └─► audit_events (append-only)
   │
   └─ /api/assets/:id ──► Worker reads R2 after an authorisation check
```

Why one Worker instead of Pages + a separate API:

- first-party cookies, so no `SameSite=None` and no CORS preflight;
- one `APP_ORIGIN`, so the Origin allowlist is a single value;
- one deploy unit and one rollback;
- `run_worker_first: ["/api/*"]` means static requests never touch Worker code,
  and the SPA fallback (`not_found_handling: single-page-application`) keeps deep
  links working.

The Pages alternative is documented in [`DEPLOYMENT.md`](./DEPLOYMENT.md#appendix-a-pages--separate-api-alternative);
it is not implemented.

## 2. Repository layout

| Path | Responsibility |
| --- | --- |
| `worker/src/index.ts` | Worker entry: route table, request ID, security headers, cron handler. |
| `worker/src/router.ts` | Explicit method+pattern router. No wildcards, no proxying, no method override. |
| `worker/src/http.ts` | Typed `ApiError`, JSON envelopes, bounded body reading, cookies, Origin check, client IP. |
| `worker/src/auth.ts` | Session issue/read/revoke, CSRF assertion, role gates, cookie security. |
| `worker/src/crypto.ts` | PBKDF2-SHA256 (210k iterations), random tokens, SHA-256, constant-time compare. |
| `worker/src/validation.ts` | Declarative body schema validator (types, bounds, enums, nullability, unknown-key rejection). |
| `worker/src/urls.ts` | Social-post URL allowlist, canonicalisation and post identity. |
| `worker/src/rateLimit.ts` | D1 fixed-window counters. |
| `worker/src/audit.ts` | Append-only audit writer. |
| `worker/src/campaigns.ts` | Campaign state machine and lifecycle description. |
| `worker/src/projection.ts` | Role-scoped read model returned by `GET /api/bootstrap`. |
| `worker/src/repo.ts` | Shared campaign/counter queries. |
| `worker/src/cron.ts` | Hourly cleanup and time-based campaign transitions. |
| `worker/src/routes/*.ts` | HTTP handlers grouped by audience: `auth`, `creator`, `admin`, `assets`, `activity`, `community`, `public`. |
| `shared/money.ts` | The only money implementation; imported by Worker **and** client. |
| `shared/community.ts` | Avatar keys, forum categories and Harare-month boundaries shared by Worker and client. |
| `src/lib/api.ts` | Every client mutation; injects CSRF, refreshes the projection. |
| `src/lib/community.ts` | Community response types plus re-exported shared constants. |
| `src/lib/sessionStore.ts` | In-memory session state and subscriber list. |
| `src/lib/firebase.ts` | Compatibility façade: now a projection store, no persistence. |
| `src/components/Avatar.tsx` | Preset avatar renderer and picker; initials fallback. |
| `src/screens/creator/CommunityScreen.tsx` | Creator New creators, leaderboard and forum surfaces. |
| `src/screens/admin/AdminCommunity.tsx` | Recent sign-ups, leaderboard preview and forum moderation. |
| `migrations/0001_init.sql` | Schema, constraints, ledger and counter triggers. |
| `migrations/0002_withdrawals.sql` | `accounts.deleted_at`, unique payout references, one open withdrawal per creator. |
| `migrations/0003_activity.sql` | Index on `campaign_members (joined_at DESC)` for the activity feed. |
| `migrations/0004_support_notifications.sql` | Support tickets/messages and notification broadcasts/read state. |
| `migrations/0005_community.sql` | Preset avatar key, forum tables and observation-time index. |
| `tests/` | Vitest suites against real workerd + D1 + R2. |
| `scripts/e2e-smoke.mjs` | HTTP smoke test against a running build. |
| `public/_headers` | Static-asset security headers and CSP. |

## 3. Request lifecycle

1. `run_worker_first` sends only `/api/*` to the Worker; assets are served by the
   edge.
2. The Worker rejects `OPTIONS` (there is no cross-origin surface), assigns a
   request ID, and reads the session cookie once.
3. `readSession` hashes the opaque token (SHA-256), loads the session joined to
   the account, rejects revoked/expired/mismatched-role/suspended sessions, and
   touches `last_seen_at` at most once a minute.
4. The route handler runs. Mutations call `guardMutation` (Origin **and** CSRF),
   then a role gate, then the declarative body validator.
5. Errors are converted to a stable JSON envelope. Unexpected errors log server
   side and return `internal_error` with the request ID — never a stack trace.
6. Every response gets `nosniff`, `X-Frame-Options: DENY`, a referrer policy and
   a permissions policy; JSON responses are `Cache-Control: no-store`.

## 4. Trust boundary

The client is a renderer and command issuer. It is never authoritative for:

- who the user is, their role, or their approval status;
- campaign state, cutoffs, eligibility, or joining closure;
- view counts, eligibility, earnings, balances, or payout amounts;
- whether a payout reference was already used;
- whether an asset may be read.

The client **does** receive, from `GET /api/bootstrap`, a role-scoped snapshot:

| Viewer | Receives |
| --- | --- |
| anonymous | live/scheduled/closing campaigns, public campaign facts, money config. No people, no money history. |
| creator | own profile, own submissions, own ledger, own payouts, campaigns joined, public campaign data. |
| admin | all campaigns, all submissions, all ledger/payout rows, creator contact details, enquiries. |

`creatorsPrivate` is empty for anonymous and for creators other than the viewer.
Brand reports are built from a separate, deliberately narrow query.

## 5. Command surface

All state changes are explicit commands. Profile, campaign, payout and admin
commands return a small JSON result and the SPA re-fetches `/api/bootstrap`, so
the UI never patches its own projection. Community writes return an id and the
Community screen re-fetches its own read endpoints; forum data is deliberately
not part of bootstrap.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | – | Liveness only. |
| `GET` | `/api/bootstrap` | optional | Role-scoped projection + CSRF token. |
| `GET` | `/api/activity` | optional | Last-24h sign-ups and campaign joins; first name for anonymous, handle for creators, uid for admins. |
| `GET` | `/api/community` | approved creator | Recent approved creators, current-month verified-view leaderboard, viewer rank and latest discussions. |
| `GET` | `/api/community/threads` | approved creator | Paginated thread list with optional category filter; hidden threads excluded. |
| `POST` | `/api/community/threads` | approved creator | New plain-text thread (5/hour); title 5–100, body 10–4,000 characters. |
| `GET` | `/api/community/threads/:id` | approved creator | Thread and visible replies; admins may also read hidden threads and replies. |
| `POST` | `/api/community/threads/:id/replies` | approved creator | Reply (20/hour); rejected when the thread is locked or hidden. |
| `GET` | `/api/admin/community` | admin | Recent sign-ups with status, leaderboard preview and moderation queue. |
| `PATCH` | `/api/admin/community/threads/:id` | admin | Pin, lock, hide or restore a thread; audited. |
| `PATCH` | `/api/admin/community/replies/:id` | admin | Hide or restore a reply; audited. |
| `GET` | `/api/notifications` | session | Role-scoped in-app notification feed with unread count. |
| `POST` | `/api/notifications/read-all` | session | Marks every visible notification read. |
| `POST` | `/api/notifications/:id/read` | session | Marks one visible notification read. |
| `POST` | `/api/admin/notifications` | admin | Broadcasts to all creators, approved creators, applicants or one account; audited. |
| `GET` | `/api/support/tickets` | session | Creators see their own; admins see all with status counts, search and paging. |
| `POST` | `/api/support/tickets` | creator | Opens a ticket (5/hour); issues a short `MH-XXXXXX` number. |
| `GET` | `/api/support/tickets/:id` | owner/admin | Full thread; ownership is checked on every read. |
| `POST` | `/api/support/tickets/:id/messages` | owner/admin | Reply; an admin reply notifies the creator and moves the ticket to in progress. |
| `PATCH` | `/api/admin/support/tickets/:id` | admin | Status and priority; resolving/closing notifies the owner; audited. |
| `POST` | `/api/auth/register` | – | Origin + IP rate limit; creates an `applied` creator. |
| `POST` | `/api/auth/login` | - | Email **or** handle; Origin + IP and per-account rate limits. |
| `POST` | `/api/auth/admin/login` | - | Email only; stricter IP and per-account limits; audited. |
| `POST` | `/api/auth/logout` | session | Origin always; CSRF when signed in; revokes the session. |
| `POST` | `/api/auth/password` | session | Verifies current password; revokes every other session. |
| `POST` | `/api/setup/admin` | one-time token | Refuses once any admin exists. |
| `POST` | `/api/campaigns/:id/join` | creator | Server checks status, cutoffs, pool closure, terms. |
| `POST` | `/api/submissions` | approved creator | Membership + cutoff + URL allowlist + duplicate post. Accepts one clip or up to two clips on different platforms. |
| `POST` | `/api/campaign-zero` | creator | Saves exactly three clips. |
| `POST` | `/api/campaign-zero/submit` | creator | Submits the application for review. |
| `PATCH` | `/api/profile` | creator | Name, niche, followers, platform, payout numbers and a preset avatar key. |
| `POST` | `/api/payouts` | approved creator | EcoCash withdrawal request; reserves balance, one open request. |
| `POST` | `/api/account/delete` | creator | Password + `DELETE`; anonymises, writes off unpaid balance, revokes sessions. |
| `POST` | `/api/uploads/proof` | creator | PNG/JPEG/WebP, magic-byte checked, private. |
| `GET` | `/api/assets/:id` | optional | Public assets open; private assets owner/admin only. |
| `POST` | `/api/enquiries` | – | Origin + IP rate limit. |
| `GET` | `/api/brand/:token` | token | Hashed token, expiry/revocation, no PII. |
| `POST` | `/api/admin/creators/:id/approve` | admin | Requires complete Campaign Zero. |
| `POST` | `/api/admin/submissions/:id/verify` | admin | Manual observation → earnings → ledger. |
| `POST` | `/api/admin/submissions/:id/reject` | admin | Records a review row; no payment. |
| `POST` | `/api/admin/payouts` | admin | Balance-checked, reference-idempotent, allocated per campaign. |
| `POST` | `/api/admin/campaigns` | admin | Creates campaign + counters + allocation entry; supports draft/scheduled/live, content fields and an optional per-post cap. |
| `POST` | `/api/admin/campaigns/:id/top-up` | admin | Increases budget and pool atomically. |
| `GET` | `/api/admin/campaigns/:id/members` | admin | Paginated joiners with join time, platform, niche, review state, clips, views and earnings. |
| `POST` | `/api/admin/campaigns/:id/poster` | admin | Uploads/replaces a public campaign poster (PNG/JPEG/WebP, magic-byte checked). |
| `PATCH` | `/api/admin/campaigns/:id/status` | admin | State-machine validated. |
| `POST` | `/api/admin/campaigns/:id/brand-token` | admin | Returns the raw token once; stores only its hash. |
| `PATCH` | `/api/admin/enquiries/:id` | admin | Funnel status. |

## 6. Campaign lifecycle

```
draft ──► scheduled ──► live ──► closing ──► completed
  │           │           │         │
  └───────────┴───────────┴─────────┴──► cancelled
                          ▲
                          └── paused (admin only; resumes to live)
```

Rules enforced server-side (`worker/src/campaigns.ts` + handlers):

- joins only while `live`, before `joining_cutoff_at`, and before the pool is
  80 % committed;
- submissions only while `live`, before `submission_cutoff_at`;
- verification only after submission and before `views_cutoff_at`;
- `completed` only when `views_cutoff_at` has passed **and** no submission is
  still `submitted` — an unreviewed clip can never be silently dropped;
- illegal transitions are rejected with `409`;
- the hourly cron performs `scheduled → live`, `live → closing` and
  `closing → completed`, writing an audit row for each automatic change.

Joining is not a payment guarantee, and the UI copy says so. Eligibility to earn
depends on an approved post that later clears manual view verification.

## 7. Money model

`shared/money.ts` is the single implementation. Both Worker and client import it;
only the Worker's result is binding.

| Rule | Value |
| --- | --- |
| Currency | USD, integer cents, `CHECK (currency = 'USD')` |
| Brand price | 150 cents / 1,000 verified views |
| Creator rate | 100 cents / 1,000 verified views |
| Creator pool | `floor(budget × 100 / 150)` |
| Per-post cap | 25 % of pool (stored per campaign, nullable) |
| Absolute per-post ceiling | 50,000 cents ($500) |
| Qualifying threshold | 1,000 verified views |
| Joining closes | 80 % of pool committed |
| Minimum payout | 500 cents ($5) |
| Payout delay | 72 h after close |
| Required days live | 30 (review checklist) |
| Campaign budget ceiling | 5,000,000 cents ($50,000) |

Rounding is always **down**, in favour of the budget. `eligibleViews` is computed
after the post cap, the absolute ceiling **and** the remaining pool, so a creator
is never shown views as payable that the pool cannot fund.

### Budget exhaustion

When a verified clip would earn more than the pool has left:

1. the payable amount is capped at the remaining pool;
2. the difference is stored as `shortfall_cents` on the observation **and**
   accumulated on `campaign_counters`;
3. the earning is committed for what is available;
4. the campaign stays `live`/`closing` so an administrator can top it up and
   re-verify the shortfall later.

Nothing is silently discarded: the brand report shows the shortfall, and the
admin console surfaces it. If the pool is fully exhausted before verification,
the endpoint returns `409` and asks for a top-up rather than recording a
zero-value verification.

### Ledger semantics

- `earnings_ledger` is append-only (UPDATE and DELETE triggers abort).
- Positive `earning`/`adjustment`/`reversal` rows must fit the pool (trigger).
- Any negative row must keep the creator's running balance ≥ 0 (trigger).
- `payout` rows are negative; the projection presents them as positive `paid`
  amounts.
- Creator withdrawals reserve funds at request time (`payouts.status =
  'requested'`) without writing a ledger row. The projection subtracts open
  payouts from `owedCents` and reports them as `reservedCents`.
- Settling a request (`status = 'paid'`) writes the negative `payout` row and
  increments `campaign_counters.paid_cents`. Cancelling or failing a request
  releases the reservation with no ledger movement.
- A payout reference is globally unique; a replay returns `409`.
- `payout_allocations` may never exceed what a campaign has actually credited
  that creator (trigger).
- Corrections are new rows, never edits.

## 8. Idempotency and concurrency

D1 executes `batch()` sequentially and transactionally, so a multi-statement
write either fully applies or fully rolls back. On top of that:

| Operation | Guard |
| --- | --- |
| Join | composite primary key + `INSERT OR IGNORE` |
| Submit clip | `post_url_normalized` unique |
| Verify clip | `uniq_current_observation` partial unique index |
| Payout | `payouts.idempotency_key` unique, plus explicit reference pre-check → `409` |
| Withdrawal request | `uniq_open_payout` partial unique index (one open request per creator) |
| Payout reference | `uniq_payout_reference` partial unique index |
| Earnings | `earnings_ledger.idempotency_key` unique |
| Campaign Zero clip | `url_normalized` unique |
| Budget race | ledger trigger `budget_exhausted` + bounded retry (3 attempts) |
| Double verify | second request returns `409`, not a second payment |

The generic `idempotency_keys` table exists but is **not used**; idempotency is
domain-level (see `SECURITY.md` § Known gaps).

## 9. Client data layer

- `src/lib/sessionStore.ts` holds the session, CSRF token and expiry **in memory
  only**. Nothing is written to `localStorage` or `sessionStorage`.
- On boot, `initSession()` calls `/api/bootstrap`. On success the payload is
  applied to the projection store; on failure the app renders signed out.
- `src/lib/firebase.ts` keeps the old exported names used by screens, but each
  one now reads the server projection. The screens were changed only where a
  value must come from the server.
- `src/lib/api.ts` wraps every mutation, attaches `X-CSRF-Token`, maps the JSON
  error envelope to a typed `ApiFailure`, and refreshes the projection after a
  successful write.
- No credentials, hashes, seed data or other creators' PII are in the bundle.
  The console shell is served only at `/console/<ADMIN_PATH>`; `ADMIN_PATH` is a
  Worker secret, so the secret URL is not in the bundle. The path gate hides the
  entry point; admin APIs still enforce the session and role boundary.
- The activity popup is a separate, lightweight `GET /api/activity` poll every
  25 s while the tab is visible; it never re-fetches the full bootstrap. The
  first call replays the last 24 h, then the server cursor drives incremental
  updates. The admin joiner drawer polls its own paginated endpoint the same
  way.

### Community surfaces

- **Avatars.** `creator_profiles.avatar_key` stores one of 16 preset keys. The
  avatar art is code shipped with the SPA; there is no profile-photo upload,
  no R2 object and no extra storage cost. Missing keys fall back to initials on
  a deterministic colour.
- **Leaderboard.** The current month is calculated in Africa/Harare (fixed
  UTC+2). The query sums `view_observations.verified_views` for `is_current = 1`
  observations on approved submissions, groups by creator and returns the top
  20. It reads the existing audit row; there is no denormalised stats table and
  no cron job. A signed-in creator outside the top 20 still receives their own
  rank and total.
- **Forum.** The community is visible only to approved creators; administrators
  can read and moderate. Threads are plain text (React escapes them), have no
  attachments, HTML, Markdown, link previews, reactions, direct messages,
  search or email notifications, and are rate-limited at 5 threads/hour and 20
  replies/hour per account. Moderation is pin, lock, hide/restore thread and
  hide/restore reply. Hidden content is excluded from creator reads.
- The Community screen fetches `/api/community` and forum pages on demand; that
  data is not part of the bootstrap projection, so opening the app does not pay
  for community queries.

## 10. Configuration

| Name | Type | Purpose |
| --- | --- | --- |
| `DB` | D1 binding | System of record. |
| `MEDIA` | R2 binding | Private proofs and brand assets. |
| `ASSETS` | Assets binding | SPA delivery + fallback. |
| `ENVIRONMENT` | var | `production` enables HSTS. `Secure` cookies are set on every HTTPS request regardless. |
| `APP_ORIGIN` | var | Exact allowed Origin for mutations. |
| `SESSION_TTL_CREATOR_SECONDS` | var | Clamped 600–86,400; default 28,800. |
| `SESSION_TTL_ADMIN_SECONDS` | var | Clamped 300–3,600; default 1,800. |
| `MAX_UPLOAD_BYTES` | var | Clamped 1 KiB–10 MiB; default 5 MiB. |
| `PUBLIC_ACTIVITY` | var | `"false"` hides the public landing-page activity feed. Defaults to on. |
| `ADMIN_SETUP_TOKEN` | secret | One-time first-admin creation. Remove after use. |
| `IP_PEPPER` | secret | Peppers hashed IPs; raw IPs are never stored. |
| `ADMIN_PATH` | secret | Secret suffix for `/console/<ADMIN_PATH>`. Unset = console disabled. |

## 11. Scheduled work

`triggers.crons: ["17 * * * *"]` runs `runScheduled`:

- deletes sessions expired/revoked more than 7 days ago;
- deletes rate-limit windows older than 24 h and expired idempotency keys;
- advances `scheduled → live` and `live → closing` on their timestamps;
- completes `closing` campaigns whose view cutoff has passed and which have no
  pending submissions;
- audits every automatic transition.

Limits are 100 campaigns per run per transition; the next hourly run continues.

## 12. Known design gaps

These are deliberate and documented, not hidden:

1. **No post-approval correction flow.** `view_observations.supersedes_id` and
   `earnings_ledger` `adjustment`/`reversal` types exist, and the ledger accepts
   them, but no endpoint exposes them yet. A wrong verification can only be
   corrected by a manual D1 statement today.
2. **`idempotency_keys` is reserved but unused.** Domain keys cover the current
   write paths; a generic replay cache is not wired.
3. **Poster/brand-asset upload is not implemented.** `campaign_assets` supports
   `poster`, `brand_logo` and `brand_material`, and `GET /api/assets/:id` can
   serve them, but no admin upload endpoint creates them. `handlePublicAssetRead`
   is currently an unrouted alias of `handleAssetRead`.
4. **No email provider.** No verification mail, no self-service reset. Recovery
   is admin-assisted.
5. **No payment provider.** Payouts are recorded against a manual reference; no
   money moves and no provider callback exists.
6. **Manual view verification only.** No platform API or scraping. The audit row
   records the administrator, timestamp, observed count and note.
7. **Single-region D1.** No read replica or cross-region failover.
8. **Account deletion is a soft delete.** PII is anonymised immediately and
   sessions are revoked, but financial rows (ledger, submissions, payouts) are
   retained for audit. No automated retention/purge job exists.
9. **Withdrawals are settled manually.** A creator can request one withdrawal at
   a time; an administrator sends EcoCash and records the reference. There is no
   provider callback or automatic reconciliation.
10. **Community v1 has no report, block, edit, search, attachment or notification
    flow.** Access is approved-creator-only, the forum is plain text, and admins
    manually hide, lock or pin content. Report tooling is deliberately deferred
    until moderation volume justifies it.

## 13. Verification status

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` (client) | pass |
| `npx tsc -p worker/tsconfig.json` | pass |
| `npx tsc -p tests/tsconfig.json` | pass |
| `npm run build` | pass |
| `npx wrangler deploy --dry-run` | pass (no network, uploads nothing) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npx vitest run` | 135/135 pass across 13 files (activity, joiners, posters, country inference, support/notifications, batch clip submissions, auth hardening, console path gate and community) |
| `node scripts/e2e-smoke.mjs` against `wrangler dev` | 28/28 pass, twice |
| Production deploy | **not performed** |
