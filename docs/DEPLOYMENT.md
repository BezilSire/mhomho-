# MHOMHO — Deployment & Operations Runbook

Date: 2026-10-24
State: **not deployed**. This document is the approval-gated release plan.

Everything here targets Cloudflare Workers + Static Assets + D1 + R2. No paid
add-on is required beyond the standard Workers/D1/R2 usage, but R2 storage and
D1 rows do incur normal account charges once used.

---

## 1. What gets deployed

One Worker named `mhomho` containing:

- the API (`worker/src/index.ts` bundled to `dist/mhomho/index.js`);
- the SPA (`dist/client`, served by the `ASSETS` binding);
- the D1 binding `DB`;
- the R2 binding `MEDIA`;
- the hourly cron trigger.

`wrangler.jsonc` is copied into `dist/mhomho/wrangler.json` by the Vite plugin,
and `.wrangler/deploy/config.json` redirects `wrangler` commands to it. That is
why `npm run deploy:dry` works from the repository root.

## 2. Prerequisites

| Requirement | Check |
| --- | --- |
| Node.js 20+ | `node -v` |
| Cloudflare account with Workers, D1 and R2 enabled | dashboard |
| Wrangler authenticated | `npx wrangler whoami` |
| Repository dependencies installed | `npm ci` |
| All local checks green | `npm run typecheck && npm test && npm run build` |

## 3. One-time resource creation

Run these once per Cloudflare account. They create billable resources; review
usage pricing before proceeding.

```bash
# 1. D1 database
npx wrangler d1 create mhomho-db
#    → copy the printed database_id

# 2. R2 bucket (private; no public bucket / custom domain)
npx wrangler r2 bucket create mhomho-media
```

Edit `wrangler.jsonc` and replace the placeholder:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "mhomho-db",
    "database_id": "<the id printed by d1 create>",   // was 00000000-0000-0000-0000-000000000000
    "migrations_dir": "migrations"
  }
]
```

The committed placeholder is intentional: a real account ID must never be
guessed or committed by an agent.

## 4. Production configuration

Set these in `wrangler.jsonc` **before** building, because the build copies the
config into `dist/mhomho/wrangler.json`:

```jsonc
"vars": {
  "ENVIRONMENT": "production",
  "APP_ORIGIN": "https://<your-production-host>",
  "SESSION_TTL_CREATOR_SECONDS": "28800",
  "SESSION_TTL_ADMIN_SECONDS": "1800",
  "MAX_UPLOAD_BYTES": "5242880",
  "PUBLIC_ACTIVITY": "true"
}
```

- `PUBLIC_ACTIVITY="false"` switches off the anonymous landing-page activity
  popups immediately. Signed-in creators and admins keep their feed.

- `ENVIRONMENT=production` adds HSTS and forces `Secure` cookies. Independently,
  any request served over HTTPS gets a `Secure`, `__Host-`-prefixed session
  cookie, so a forgotten env var cannot downgrade cookie security.
- `APP_ORIGIN` must exactly match the browser origin (scheme + host, no trailing
  slash). A mismatch makes every mutation fail with `403 Cross-origin request
  blocked`.
- Session TTLs and the upload cap are clamped in code, so a typo cannot disable
  the limits.

Secrets are **not** in `wrangler.jsonc`:

```bash
# Long random values, e.g. `openssl rand -hex 32`
npx wrangler secret put ADMIN_SETUP_TOKEN
npx wrangler secret put IP_PEPPER
npx wrangler secret put ADMIN_PATH
```

`ADMIN_PATH` is the secret suffix of the operations console:
`https://<host>/console/<ADMIN_PATH>`. Use a long random value such as
`ops-` plus `openssl rand -hex 24`. If it is unset, every `/console/*` request
returns 404. The value is never included in the client bundle.

`ADMIN_SETUP_TOKEN` is only needed until the first administrator exists. After
setup, delete it:

```bash
npx wrangler secret delete ADMIN_SETUP_TOKEN
```

`IP_PEPPER` must remain: changing it invalidates existing IP hashes (rate-limit
buckets and audit correlation), but does not break logins.

## 5. Build

```bash
npm ci
npm run typecheck
npm test            # ~5 minutes: real workerd + D1 + R2, per-test reset
npm run build
npm run deploy:dry  # bundles and validates config, uploads nothing
```

`npm run build` writes `dist/client` (static) and `dist/mhomho` (Worker bundle +
generated `wrangler.json`). The Vite plugin also writes a local
`dist/mhomho/.dev.vars`; `wrangler deploy` ignores it, and it is not inside
`dist/client`, so it is never served.

## 6. Database migration

Apply migrations **before** the first request that needs them, and before
deploying code that depends on a new schema:

```bash
npx wrangler d1 migrations apply mhomho-db --remote
```

- `0001_init.sql` through `0005_community.sql` contain schema only - no seed data, no demo accounts. `0005` adds the preset avatar key, forum tables and the observation-time index used by the monthly leaderboard.
- The command is idempotent: applied migrations are tracked in
  `d1_migrations`.
- For a dry inspection: `npx wrangler d1 migrations list mhomho-db --remote`.

## 7. Deploy

```bash
npx wrangler deploy
```

Expected output: upload of one Worker, N static assets, and confirmation of the
D1/R2 bindings and the cron trigger.

Optional versioned release with instant rollback:

```bash
npx wrangler versions upload
npx wrangler versions deploy
```

## 8. First-run setup (required)

There is no seeded administrator. Create the first one with the one-time token:

```bash
curl -i https://<host>/api/setup/admin \
  -H 'Origin: https://<host>' \
  -H 'Content-Type: application/json' \
  --data '{"setupToken":"<ADMIN_SETUP_TOKEN>","email":"ops@<host>","password":"<>=12 chars, unique>"}'
```

Expect `201`. Then:

1. sign in at `https://<host>/console/<ADMIN_PATH>`;
2. confirm the session cookie has `HttpOnly; Secure; SameSite=Lax`;
3. delete `ADMIN_SETUP_TOKEN` (step 4);
4. record the administrator in the password manager.

The endpoint returns `409` once any administrator exists, even with a valid
token. It also rate-limits to 5 attempts per IP per hour.

## 9. Post-deploy verification

Run these in order; stop at the first failure.

```bash
# 1. Liveness
curl -s https://<host>/api/health
# → {"ok":true}

# 2. Static shell + headers
curl -sI https://<host>/
# → 200, text/html, X-Frame-Options: DENY, CSP present

# 3. SPA fallback
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/creator/earnings
# → 200

# 4. Anonymous projection leaks nothing
curl -s https://<host>/api/bootstrap
# → data.viewer null, data.creatorsPrivate {}

# 5. Cross-origin mutation refused
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<host>/api/auth/login \
  -H 'Origin: https://evil.example' -H 'Content-Type: application/json' \
  --data '{"identifier":"x","password":"y"}'
# → 403

# 6. Method handling
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE https://<host>/api/health
# → 405

# 7. Anonymous community access refused
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/api/community
# → 401

# 8. Cookie flags after a real admin login (browser devtools)
# → mhomho_session: HttpOnly, Secure, SameSite=Lax
```

After the first approved creator exists, sign in as that creator and confirm the
Community tab opens, a preset avatar can be saved, and one thread plus reply can
be posted and moderated from the admin Community tab.

For a full HTTP flow against a local build, see §11.

## 10. Rollback

### Worker code

```bash
npx wrangler deployments list
npx wrangler rollback <version-id>
```

Rollback restores code and static assets. It does **not** undo data written by
the newer version.

### Schema

Migrations are forward-only; there is no down-migration. Options, in order of
preference:

1. **Forward fix** — ship a new migration that adds the missing column/table.
2. **Restore from export** — for a broken migration in a low-traffic window:

   ```bash
   npx wrangler d1 export mhomho-db --remote --output pre-fix-$(date +%F-%H%M).sql
   # then apply a corrective migration, or restore into a new database and
   # repoint the binding
   ```

3. **Drop and recreate** — only for an environment with no real data. Never in
   production without an export.

The ledger is append-only by trigger, so financial history survives code
rollbacks; a bad *credit* is corrected with a new reversal row, not a delete.

### R2

Assets are immutable (unique keys). A bad upload is marked `status='deleted'` in
`campaign_assets` (after a code change that honours it) or removed manually:

```bash
npx wrangler r2 object delete mhomho-media --key "<object_key>"
```

Deleting an object does not delete the ledger or the submission.

## 11. Local development and E2E

### Dev server

```bash
npm run dev        # Vite + Cloudflare plugin on http://localhost:3000
```

The plugin runs the Worker and the SPA together. Local secrets come from
`.dev.vars` (gitignored):

```
ADMIN_SETUP_TOKEN="local-dev-admin-setup-token-0001"
IP_PEPPER="local-dev-ip-pepper-0001"
ADMIN_PATH="ops-local-console-change-me"
```

Open the operations console at
`http://localhost:3000/console/ops-local-console-change-me` (or your own value).
Wrong `/console/*` paths return 404.

Local D1 lives in `.wrangler/state/v3/d1`. Apply migrations after a clean:

```bash
npm run db:migrate:local
```

Reset local state completely (destroys local data only):

```bash
rm -rf .wrangler/state
npm run db:migrate:local
```

### HTTP smoke test

```bash
npm run build
npx wrangler dev --port 8787 --var APP_ORIGIN:http://127.0.0.1:8787
# in a second terminal:
node scripts/e2e-smoke.mjs
```

`APP_ORIGIN` must match the port you actually use. The script is safe to re-run:
if an administrator already exists, setup returns `409` and the script logs in
instead. It creates its own creator, campaign, submission and payout, so it does
not depend on fixtures.

Expected result: `28/28 checks passed.`

## 12. Operations runbook

| Task | Action |
| --- | --- |
| Approve a creator | Admin console → verification queue → Approve. Requires 3 Campaign Zero clips, a follow confirmation, and one clip ≥ 1,000 views. |
| Verify a clip | Admin console → verification queue → enter the **observed public count**, an evidence note, then verify. Earnings are computed server-side. |
| Reject a clip | Enter a note. No ledger row is written. |
| Campaign pool exhausted | Top up the campaign (budget + pool increase atomically), then verify the remaining clips. Shortfalls are visible in the campaign stats. |
| Record a payout | Admin console → payouts → creator, amount, reference. The amount must not exceed the balance; a reused reference returns `409`. |
| Rotate an administrator password | No self-service reset. Use a one-off D1 statement with a fresh PBKDF2 hash, then revoke sessions. |
| Suspend an account | `UPDATE accounts SET status='suspended'` — takes effect on the next request. |
| Revoke all sessions for an account | `UPDATE accounts SET session_version=session_version+1` **and** set `revoked_at` on its sessions. |
| Inspect the ledger | `npx wrangler d1 execute mhomho-db --remote --command "SELECT ..."` (read-only queries). |
| Check cron ran | Look for `campaign.auto_transition` / `campaign.auto_complete` rows in `audit_events`. |
| Daily backup | `npx wrangler d1 export mhomho-db --remote --output backups/$(date +%F).sql` |

### Things that will look like bugs but are not

- **`403 Cross-origin request blocked`** — `APP_ORIGIN` does not match the
  browser origin. Fix the var; do not disable the check.
- **`403 Invalid or missing CSRF token`** — the SPA has an old bootstrap payload
  or the session expired. Reload; the app re-fetches `/api/bootstrap`.
- **`401` immediately after login** — the site is being served over HTTP while
  `ENVIRONMENT=production` (the browser refuses the `Secure` cookie), or
  `APP_ORIGIN` points at a different scheme/host.
- **`409 This submission has already been verified`** — correct behaviour; a
  second verification would double-pay.
- **`409 The creator pool is exhausted`** — top up, then verify.
- **`409 A payout with that reference has already been recorded`** — correct;
  use a new reference for a new payment.
- **`503`/`500` on the first request after deploy** — migrations not applied, or
  the D1 binding points at the placeholder ID.

## 13. Monitoring

`observability` is enabled with 10 % head sampling. Recommended before launch
(not configured here):

- Cloudflare alert on Worker 5xx rate;
- alert on `audit_events` write failures;
- D1 storage/row-read alerts;
- R2 bucket size alert;
- uptime check on `/api/health` and `/`.

## 14. Cost and blast radius

| Resource | Created by | Notes |
| --- | --- | --- |
| Worker | `wrangler deploy` | Free tier covers low traffic; paid plan for production traffic. |
| Static assets | same deploy | No separate bucket. |
| D1 | `wrangler d1 create` | Rows grow with submissions, observations, audit. |
| R2 | `wrangler r2 bucket create` | Only proof uploads today (≤ 5 MiB × 30/h/account). |
| Cron | `triggers.crons` | One run per hour. |

No DNS, custom domain, email, payment or third-party API is configured by this
repository. Adding a custom domain is a separate, approval-gated change.

## 15. Pre-launch checklist

- [ ] Real `database_id` committed (not the placeholder).
- [ ] `ENVIRONMENT=production`.
- [ ] `APP_ORIGIN` matches the live host exactly.
- [ ] `ADMIN_SETUP_TOKEN`, `IP_PEPPER`, and `ADMIN_PATH` set as secrets.
- [ ] Migrations applied to the remote database.
- [ ] First administrator created; setup token deleted.
- [ ] `npm run typecheck`, `npm test`, `npm run build`, `npm run deploy:dry` green.
- [ ] Post-deploy checks in §9 pass.
- [ ] Preset avatar, community leaderboard and forum smoke-tested as an approved creator.
- [ ] Backup schedule agreed.
- [ ] Cloudflare WAF/rate limiting decision recorded.
- [ ] Privacy notice updated for PII retention and manual review.
- [ ] Explicit owner approval to deploy.

---

## Appendix A: Pages + separate API alternative

Rejected for this project, documented for completeness. It requires:

- a Pages project for `dist/client` and a Worker (or Pages Functions) for
  `/api/*`;
- either a custom domain that puts both on the same site (so cookies stay
  first-party), or `SameSite=None; Secure` cookies plus an explicit CORS
  allowlist and preflight handling;
- two deploy units and two rollback paths;
- a second place to keep `APP_ORIGIN` correct.

The single-Worker design avoids all of that. If Pages is required later, the
Worker code is unchanged; only hosting, cookie attributes and CORS would need
adjustment.

## Appendix B: Why there is no `0002_dev_seed.sql`

Demo fixtures used to be compiled into the client bundle. Seeding them through a
migration would risk applying demo accounts, including password hashes, to
production. Instead:

- migrations stay schema-only;
- `scripts/e2e-smoke.mjs` creates its own data through the public API;
- local development starts empty and creates a real administrator via
  `/api/setup/admin`.

If a persistent local demo dataset is wanted later, add it as a script that calls
the API, not as a migration.
