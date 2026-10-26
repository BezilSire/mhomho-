# MHOMHO — Phase 1 Architecture & Security Audit

Date: 2026-10-24
Scope: the repository at the workspace root, commit `7f9b31c`.

This audit was produced **before** any modification. It separates what the code
actually does from what the UI implies.

---

## 1. Existing architecture

| Layer | Reality |
| --- | --- |
| Frontend | React 19 + TypeScript, Vite 8, Tailwind CSS 4, `lucide-react`, `motion`. Single-page app, no router library (view state in `src/App.tsx`). |
| Styling | Custom design tokens in `src/styles/tokens.css`. Deliberate dark/light brand system. Must be preserved. |
| "Backend" | **None.** `src/lib/firebase.ts` is a localStorage-backed, synchronous in-browser store (`mhomho_db_state_v1`). It is named `firebase` but does not use Firebase. |
| "Cloud functions" | Plain exported functions in `firebase.ts` (`registerCreator`, `joinCampaign`, `submitClip`, `verifyClipTransaction`, `markPaid`, `topUpCampaign`, …). They mutate the same localStorage object. |
| Authentication | `src/lib/auth.ts`. Client-side PBKDF2-SHA256 (120k) over the localStorage store; "session" is a JSON object in `sessionStorage`; admin credentials are `VITE_ADMIN_*` values that are **bundled into the public JavaScript**. |
| Database | None. Seed data is compiled into the bundle (3 campaigns, 4 creators, 7 clips, ledger and payout fixtures). |
| File storage | None. `SubmitClip` records only a filename string. `screenshotUrl` points at `/uploads/<name>` which does not exist. |
| Deployment | Vite static build (`dist/`). No Wrangler, no Pages, no Workers, no D1, no R2 configuration. |
| Tests | `tests/money.test.ts` is a hand-rolled assertion function; **not wired to any test runner**. `npm test` does not exist. `npm run lint` is `tsc --noEmit` and currently passes. |
| External services | None connected. No Firebase project, no payment provider, no social platform API, no email provider. `.env.example` still references a Gemini key and AI Studio app URL that the app never uses. |
| Repo hygiene | `.env.local` is untracked and gitignored. No secret values found in tracked history (only placeholders in `.env.example`). |

### Page/route map (state-driven)

- Public landing (`LandingPage`): brand pitch, creator application, brand enquiry form.
- Creator portal: Home, Campaigns feed, Campaign detail, Submit clip, My clips, Earnings, Profile, Under review (Campaign Zero).
- Admin console at `/console/<ADMIN_PATH>` (server-gated secret path): Dashboard/applicant funnel, verification queue, campaigns, payouts, enquiries.
- Brand report (`BrandCampaignPage`): rendered only from a hard-coded `glow-skincare` token; unreachable in normal navigation.
- Dead code: `ApplicationScreen.tsx`, `BrandInquiryWizard.tsx` are not imported anywhere.

## 2. What actually works

Functionally, within a single browser:

- Campaign Zero application flow with client-side validation and proof-of-work fields.
- Creator login by handle/email against client-held PBKDF2 hashes; throttling in `sessionStorage`.
- Campaign browsing, joining (duplicate-guarded), clip submission with 1,000-view floor, URL host allowlist, 5× "spike" flag.
- Admin queue approve/reject, client-computed earnings, ledger and payout records, campaign top-up.
- Money maths (`src/lib/money.ts`) is coherent and matches the stated model: $1.50 brand CPM, $1.00 creator CPM, 2/3 creator pool, 25 % per-post cap, 80 % joining close, $5 payout minimum.

## 3. Missing functionality

- Any server, database, session, or persistent multi-user state.
- Server-side authorization of any kind.
- Real file upload/storage; proof screenshots are never captured.
- Any separation between submission, approval and view verification (one admin action does all three).
- Idempotency, concurrency control, or atomic budget accounting.
- Campaign state machine (only `open | closed | full`, mutated ad hoc).
- Submission deadlines / view cutoffs enforced by time.
- Payout requests, approval workflow, failed/cancelled payouts, allocations per campaign.
- Audit log, view-observation history, admin correction trail.
- Email verification, password reset, account suspension enforcement.
- Pagination, backups, monitoring, rate limiting server-side.

## 4. Security and data-integrity gaps

**Critical**

1. **No server-side trust boundary.** Every rule (budgets, CPM, approvals, payouts) runs in the browser. Anyone can edit localStorage, call `verifyClipTransaction(..., 'admin')`, or set `creatorsPublic[uid].status = 'approved'`.
2. **Admin credentials are public.** `VITE_*` variables are embedded in the JS bundle; the PBKDF2 hash and salt are shipped to every visitor. The "hidden hash route" is not a control.
3. **Creator private data is bundled.** Seed private records (names, phone numbers, email, payout numbers, password hashes) ship to every browser. `creatorsPrivate` is one localStorage object containing all creators.
4. **Money is client-computed.** `calculateClipEarnings` can be replayed/edited; the ledger is a mutable object.

**High**

5. Session token is a random string with no server counterpart, no revocation, and is trusted solely because it is in `sessionStorage`.
6. `joinCampaign` trusts the caller's UID; `submitClip` trusts claimed views and creator handle; `markPaid` trusts an arbitrary amount.
7. `markPaid` marks any amount as paid without checking the actual balance; it can double-pay.
8. `verifyClipTransaction` accepts already-verified clips and re-credits them (no status/idempotency guard).
9. Budget checks are read-then-write with no atomic guard; concurrent verification can exceed the pool.
10. No CSRF concept, no CORS policy, no security headers, no server-side request validation.
11. Screenshot "upload" is unimplemented; `storage.rules` describes a Firebase project that does not exist.
12. `AdminVerificationQueue` renders `screenshotUrl` as text only; no content validation possible.

**Medium**

13. PII retained indefinitely; no deletion/retention policy.
14. Payout destination (EcoCash number) is displayed in admin UI with no masking and no access log.
15. No audit trail for approvals, rejections, budget changes, or payouts.
16. `brandViews` is a mutable public-token object; one hard-coded token is used for every brand page.
17. `firestore.rules`/`storage.rules` give a false impression of protection; they apply to infrastructure that does not exist.
18. `README.md` is missing; onboarding depends on an AI Studio scratch plan.

## 5. Recommended migration strategy (safest path)

Keep the React/Vite frontend and its design system. Replace only the data
layer and put every trusted operation behind a Worker.

1. **Single Cloudflare Worker + Static Assets** serving the SPA and `/api/*`
   from one origin. This keeps cookies first-party (no CORS, simpler CSRF),
   avoids Pages/Worker cross-origin complexity, and deploys as one unit.
   Pages remains a valid alternative; documented in `docs/DEPLOYMENT.md`.
2. **D1** as the system of record with explicit migrations, foreign keys,
   CHECK constraints, append-only financial ledger, and SQL triggers that make
   budget over-commitment and negative balances impossible even if application
   code regresses.
3. **R2** for posters/brand assets (public-by-route) and proof screenshots
   (private, owner/admin only). No public bucket; the Worker is the only door.
4. **Server-owned authentication**: PBKDF2 in the Worker, opaque session tokens
   hashed at rest, HttpOnly/Secure/SameSite cookies, CSRF double-submit,
   D1-backed rate limits, 8 h creator / 30 min admin sessions, revocation via
   `session_version`.
5. **Frontend becomes a read-only projection** of server state plus explicit
   commands. Client keeps rendering the same screens; it no longer computes
   money or permissions.
6. **Migrate the demo fixtures** into an optional development seed migration
   (`0002_dev_seed.sql`) that is never applied to production.

Reversibility: no production resource exists today, so there is nothing to
migrate or destroy. All work is additive to the repo. Deployment is a separate,
approval-gated step.

## 6. Risks and decisions requiring approval

| # | Decision | Safe default taken in this change |
| --- | --- | --- |
| D1 | Cloudflare **Worker + Static Assets** (one origin) instead of Pages + separate API | Implemented; Pages path documented |
| D2 | Budget-exhaustion rule | Commit what remains, record the shortfall explicitly, move campaign to `closing`. **Needs your confirmation** (alternative: hold the submission unpaid and require a top-up) |
| D3 | 25 % per-post cap | Retained as the per-campaign default, stored per campaign, nullable |
| D4 | No payment provider integration | Payouts are recorded manually with references; no money moves |
| D5 | No email provider | No email verification / self-service reset; admin-assisted reset only |
| D6 | Campaign Zero remains unpaid | Unchanged |
| D7 | Admin credentials | Removed from the bundle; created server-side via one-time setup token |
| D8 | Social view verification | Manual, auditable review only (no scraping, no invented platform APIs) |
| D9 | Currency | USD only, integer cents, enforced by CHECK constraint |

## 7. Baseline verification

- `npm run lint` (`tsc --noEmit`): **passed** before changes.
- `npm run build`: available; not yet re-run after backend addition.
- No automated test runner existed; `tests/money.test.ts` was unreachable.

---

See `docs/ARCHITECTURE.md` for the implemented design,
`docs/SCHEMA.md` for the data model and money rules,
`docs/SECURITY.md` for controls and residual risk, and
`docs/DEPLOYMENT.md` for the runbook.
