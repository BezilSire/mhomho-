# MHOMHO — Data Model (D1 / SQLite)

Date: 2026-10-24
Migration: `migrations/0001_init.sql` + `migrations/0002_withdrawals.sql` + `migrations/0003_activity.sql`

All timestamps are **Unix epoch milliseconds** (`INTEGER`). All money is
**integer US cents** and `currency` is constrained to `'USD'`. No floating point
is stored anywhere.

---

## 1. Entity map

```
accounts ──1:1── creator_profiles
   │                  └──1:N── creator_campaign_zero_clips
   ├──1:N── sessions
   ├──1:N── campaign_assets
   ├──1:N── submissions ──1:N── submission_reviews
   │           └──1:N── view_observations
   ├──1:N── earnings_ledger
   ├──1:N── payouts ──1:N── payout_allocations
   ├──1:N── forum_threads ──1:N── forum_replies
   └──N:M── campaigns (campaign_members)

campaigns ──1:1── campaign_counters
   ├──1:N── campaign_budget_ledger
   ├──1:N── campaign_members
   ├──1:N── submissions
   ├──1:N── campaign_assets
   └──1:N── brand_report_tokens

enquiries, audit_events, rate_limits, app_config, idempotency_keys — standalone
```

## 2. Accounts and identity

### `accounts`

One row per login identity.

| Column | Notes |
| --- | --- |
| `id` | `TEXT` primary key, prefixed (`acc_…`). |
| `email` | As entered, for display. |
| `email_normalized` | Lowercased; **UNIQUE**; used for login. |
| `password_hash` / `password_salt` | PBKDF2-SHA256, hex. Never leaves the Worker. |
| `password_iterations` | `CHECK >= 100000`, default 210000. |
| `role` | `creator \| admin \| business`. |
| `status` | `applied \| approved \| rejected \| suspended`. |
| `session_version` | Bumped by "revoke all sessions"; session rows carry a role snapshot. |
| `last_login_at` | Nullable. |
| `deleted_at` | Set when the creator self-deletes; PII is anonymised and sessions revoked. |

Indexes: `(role, status)`, `(created_at DESC)`.

### `creator_profiles`

| Column | Notes |
| --- | --- |
| `account_id` | PK, FK → `accounts`, `ON DELETE RESTRICT`. |
| `display_name`, `handle`, `handle_normalized` | `UNIQUE (handle_normalized, platform)`. |
| `platform` | `TikTok \| Instagram \| YouTube \| Facebook`. |
| `avatar_key` | One of 16 preset keys; default `sun`. No uploaded image or R2 object. |
| `niche`, `followers`, `whatsapp_number`, `ecocash_number` | Contact/payout data; never sent to anonymous users. |
| `campaign_zero_follow_confirmed` | `0/1`; admin approval requires `1`. |
| `campaign_zero_submitted_at`, `approved_at` | Timestamps. |

### `creator_campaign_zero_clips`

Exactly three rows per applicant (`position` 0–2, `UNIQUE (account_id, position)`).
`url_normalized` is globally **UNIQUE**, so the same post cannot seed two
applications.

### `sessions`

| Column | Notes |
| --- | --- |
| `token_hash` | PK. SHA-256 of the opaque cookie token; the raw token is never stored. |
| `account_id` | FK, `ON DELETE CASCADE`. |
| `role` | Snapshot; must match the account role on read. |
| `csrf_token` | Random 24-byte token returned in the bootstrap payload. |
| `created_at`, `expires_at`, `last_seen_at`, `revoked_at` | Expiry and revocation are checked on every request. |
| `ip_hash`, `user_agent_hash` | Peppered hashes, never raw values. |

Indexes: `(account_id)`, `(expires_at)`.

## 3. Campaigns

### `campaigns`

| Column | Notes |
| --- | --- |
| `id`, `slug` | `slug` UNIQUE. |
| `title`, `brand_name`, `niche`, `brief` | Length-constrained. |
| `required_content`, `eligibility`, `hook_ideas`, `do_nots` | `hook_ideas`/`do_nots` are JSON arrays validated with `json_valid`. |
| `status` | `draft \| scheduled \| live \| paused \| closing \| completed \| cancelled`. |
| `currency` | `CHECK (currency = 'USD')`. |
| `budget_cents` | Brand budget. |
| `creator_pool_cents` | `CHECK (creator_pool_cents <= budget_cents)`. |
| `brand_cpm_cents`, `creator_cpm_cents` | `> 0`. |
| `per_post_cap_cents` | Nullable absolute cap. |
| `per_post_cap_bp` | Nullable 0–10000 basis points (25 % = 2500). |
| `qualifying_view_threshold` | Default 1000. |
| `joining_close_bp` | Default 8000 (80 %). |
| `starts_at`, `joining_cutoff_at`, `submission_cutoff_at`, `views_cutoff_at`, `ends_at` | All cutoffs are enforced by handlers and cron. |
| `terms_version` | Copied into `campaign_members`. |
| `created_by` | FK → `accounts`. |
| `settled_at`, `cancelled_at` | Set by the corresponding transitions. |

### `campaign_counters`

One row per campaign; the authoritative aggregate.

| Column | Meaning |
| --- | --- |
| `committed_cents` | Sum of positive earning/adjustment/reversal rows. |
| `shortfall_cents` | Earned-but-unfunded amount accumulated at verification. |
| `verified_views` | Observed views accepted for payment (below-threshold rejections excluded). |
| `eligible_views` | Views actually funded after every cap. |
| `joined_count` | Maintained by trigger. |
| `approved_submissions` | Maintained by trigger. |
| `paid_cents` | Reserved for payout reporting. |
| `updated_at` | Last counter mutation. |

### `campaign_budget_ledger`

Append-only budget history: `allocation`, `top_up`, `earning_commit`,
`reversal`, `payout_allocation`. `idempotency_key` is UNIQUE.

### `campaign_members`

`PRIMARY KEY (campaign_id, creator_id)`, plus `joined_at` and `terms_version`.
Membership is the gate for submissions (enforced by a composite FK from
`submissions`).

`idx_members_joined (joined_at DESC)` (migration 0003) backs the last-24h
activity feed. That feed is derived entirely from this table and
`accounts.created_at`; no separate event table exists, so a row cannot drift
out of sync with the membership it describes.

## 4. Submissions and verification

### `submissions`

| Column | Notes |
| --- | --- |
| `id` | PK. |
| `campaign_id`, `creator_id` | Composite FK → `campaign_members`; a non-member cannot submit. |
| `platform` | Same enum as profiles. |
| `post_url`, `post_url_normalized` | Normalised URL is **UNIQUE** across the whole system. |
| `claimed_views` | Creator's claim; never used for payment. |
| `proof_asset_id` | Points at a private `campaign_assets` row (not a FK, by design: assets may be purged). |
| `status` | `submitted \| approved \| rejected \| withdrawn`. |
| `review_note`, `reviewed_by`, `reviewed_at` | Manual review trail. |

### `submission_reviews`

Append-only decision log: `approve`, `reject`, `reopen`, with actor and note.

### `view_observations`

The audit trail of what an administrator actually saw.

| Column | Notes |
| --- | --- |
| `observed_views` | Public counter at review time. |
| `verified_views` | Accepted subset; `CHECK (verified_views <= observed_views)`. |
| `eligible_views` | Funded subset; `CHECK (eligible_views <= verified_views)`. |
| `gross_cents` | Uncapped value of the verified views. |
| `committed_cents` | Amount actually credited. |
| `shortfall_cents` | `gross − committed` when the pool ran out. |
| `source` | `manual` (only value currently produced). |
| `evidence_note`, `observed_by`, `observed_at` | Who checked what, when. |
| `idempotency_key` | UNIQUE. |
| `supersedes_id` | Reserved for corrections (no endpoint yet). |
| `is_current` | `1` for the live observation. |

`CREATE UNIQUE INDEX uniq_current_observation ON view_observations (submission_id) WHERE is_current = 1`
makes double verification impossible at the database level.

`idx_observations_time` on `observed_at` supports the monthly community
leaderboard, which sums `verified_views` for current observations on approved
submissions inside the Africa/Harare calendar month.

## 5. Money

### `earnings_ledger`

| Column | Notes |
| --- | --- |
| `creator_id` | FK. |
| `campaign_id`, `submission_id` | Nullable (a payout may span campaigns). |
| `entry_type` | `earning \| adjustment \| reversal \| payout \| payout_reversal \| write_off`. |
| `amount_cents` | `CHECK (amount_cents <> 0)`. Positive = credit, negative = debit. |
| `currency` | `CHECK = 'USD'`. |
| `description` | Human-readable, shown in the creator ledger. |
| `actor_id` | Who caused the row. |
| `idempotency_key` | UNIQUE. |

A creator's balance is always `SUM(amount_cents)` for that creator. There is no
mutable balance column, so it cannot drift.

### `payouts`

| Column | Notes |
| --- | --- |
| `amount_cents` | `CHECK > 0`. |
| `status` | `requested \| approved \| processing \| paid \| failed \| cancelled`. |
| `method` | `ecocash \| bank_transfer \| manual`. |
| `destination_masked` | Only the masked form is stored for display. |
| `destination_hash` | Optional lookup hash. |
| `reference` | EcoCash reference; globally **UNIQUE** (partial index), replay → `409`. |
| `idempotency_key` | UNIQUE. |
| `requested_by`, `decided_by`, `requested_at`, `decided_at`, `paid_at` | Withdrawal lifecycle audit fields. |

Indexes: `(creator_id, status, requested_at)`, plus `uniq_open_payout` — at most
one row per creator with `status IN ('requested','approved','processing')`.

Withdrawal lifecycle: `requested` reserves the amount (projection subtracts it
from `owedCents`); settling to `paid` writes the negative ledger row and
increments `paid_cents`; `cancelled`/`failed` release the reservation with no
ledger movement. A manual payout cannot be recorded while a request is open.

### `payout_allocations`

`(payout_id, campaign_id)` PK, `amount_cents > 0`. Lets a payout be attributed to
the campaigns that funded it, and is guarded so it cannot exceed that creator's
credits on that campaign.

## 6. Assets, reporting, operations

### `campaign_assets`

| Column | Notes |
| --- | --- |
| `kind` | `poster \| brand_logo \| brand_material \| proof_screenshot`. |
| `object_key` | UNIQUE R2 key; generated server-side, never client-supplied. |
| `content_type` | Sniffed from magic bytes for uploads. |
| `size_bytes` | `CHECK > 0`. |
| `checksum_sha256` | Integrity reference. |
| `visibility` | `public \| private`. |
| `status` | `pending \| ready \| deleted`. |
| Constraint | `CHECK (kind <> 'proof_screenshot' OR visibility = 'private')`. |

### `brand_report_tokens`

Stores only `token_hash`. Optional `expires_at`, `revoked_at`,
`last_viewed_at`. A token grants read access to one campaign's aggregate report —
never to creator identity or contact data.

### `enquiries`

Brand leads: business, contact, phone, niche, promo, goals (JSON), budget,
window, best times (JSON), notes, status, `ip_hash`.

### `audit_events`

Append-only by convention: actor, role, action, entity, `before_json`,
`after_json`, `request_id`, `ip_hash`, timestamp. Every privileged mutation and
every automatic cron transition writes one.

### `rate_limits`

`PRIMARY KEY (bucket, window_start)`, `count >= 0`. Fixed windows; old rows are
pruned probabilistically and by cron.

### `app_config`

Key/value JSON for operator-tunable flags. No secrets are stored here.

### `idempotency_keys`

Reserved generic replay cache (`key`, `account_id`, `endpoint`, `request_hash`,
`response_status`, `response_json`, `expires_at`). **Currently unused** — see
`ARCHITECTURE.md` § Known gaps.

### `support_tickets`

One row per creator support ticket. `ticket_number` (`MH-XXXXXX`) is the
human-readable reference; `id` stays internal. `status` is one of `open`,
`in_progress`, `resolved`, `closed`; `priority` is `low`, `normal`, `high`.
`last_message_at` drives the inbox ordering and `closed_at` is set when a ticket
is resolved or closed.

### `support_messages`

Append-only thread. `author_role` is `creator` or `admin`; `author_id` may
become null if an account row is ever removed. Messages are capped at 5,000
characters at the API and database layers.

### `notifications`

One row per broadcast, not one per recipient. `audience` is `creators`,
`approved_creators`, `applicants` or `account`; `account` requires
`audience_account_id`. Filtering happens at read time so new sign-ups see older
announcements without a backfill job.

### `notification_reads`

Per-account read receipts (`account_id`, `notification_id`, `read_at`). Unread
counts are a `LEFT JOIN … WHERE read_at IS NULL`, indexed by account.

### `forum_threads`

One row per creator discussion. `category` is `general`, `campaigns`, `payouts`
or `wins`; `status` is `active`, `locked` or `hidden`; `pinned` is `0/1`.
`title` is 5–100 characters and `body` 10–4,000 characters, enforced by `CHECK`.
`reply_count` and `last_activity_at` drive the list ordering and are updated with
each reply. The feed index is `(status, pinned DESC, last_activity_at DESC)`.

### `forum_replies`

Append-only creator replies. `status` is `active` or `hidden`; body length is
1–2,000 characters. `thread_id` cascades if a thread row is ever removed, while
authors are `ON DELETE RESTRICT` like other attributed content. Hiding a reply
keeps the text for moderation and adjusts the thread's `reply_count`.

## 7. Integrity guards (triggers)

| Trigger | Effect |
| --- | --- |
| `earnings_ledger_no_update` | Any UPDATE aborts: the ledger is append-only. |
| `earnings_ledger_no_delete` | Any DELETE aborts. |
| `earnings_ledger_budget_guard` | A positive campaign credit that would exceed `creator_pool_cents` aborts with `budget_exhausted`. |
| `earnings_ledger_apply_commit` | Applies `committed_cents` automatically, so no code path can forget. |
| `earnings_ledger_balance_guard` | Any negative row that would drive a creator balance below zero aborts with `insufficient_balance`. |
| `payout_allocation_guard` | An allocation exceeding that creator's credits on the campaign aborts. |
| `campaign_member_insert` | Increments `joined_count`. |
| `submission_approved_insert` / `_revert` | Keeps `approved_submissions` accurate on status changes. |

Because D1 `batch()` is transactional, an `ABORT` rolls back the whole sequence —
including the observation row and the status update that accompanied a rejected
ledger insert.

## 8. Invariants worth testing

1. `SUM(earnings_ledger.amount_cents)` per creator is never negative.
2. `campaign_counters.committed_cents <= campaigns.creator_pool_cents`.
3. At most one `is_current = 1` observation per submission.
4. A submission cannot exist without a matching `campaign_members` row.
5. `post_url_normalized` is globally unique.
6. `payout_allocations` per campaign never exceed that creator's credits.
7. Proof screenshots are always `private`.
8. Deleting a ledger row is impossible.

The Vitest suite asserts 1–7 directly, including a concurrent-verification race
that must produce one payment and a non-zero shortfall (or a clean `409`).

## 9. Migration policy

- Migrations are numbered, forward-only, and applied with
  `wrangler d1 migrations apply`.
- `0001_init.sql` is production-pure: **no seed data**. Demo data is created
  through the API by `scripts/e2e-smoke.mjs`, so a production database never
  inherits fixtures.
- Schema changes must be additive where possible (new table or nullable column).
  SQLite cannot drop a `CHECK`; changing an enum requires a table rebuild and a
  data copy.
- Never edit an applied migration. Add the next numbered file (`0005_*.sql`,
  and so on) instead.
- Triggers are part of the contract: if a new money path is added, it must route
  through `earnings_ledger` so the guards apply.

### Rollback

There is no down-migration. For an environment with no real data, drop tables in
reverse dependency order (the test harness does exactly this in
`tests/reset.ts`). For any environment with data, export first:

```bash
npx wrangler d1 export mhomho-db --remote --output backup-$(date +%F).sql
```

## 10. Retention

| Data | Retention |
| --- | --- |
| Sessions | Purged 7 days after expiry/revocation (cron). |
| Rate-limit windows | Purged after 24 h (cron + opportunistic). |
| Expired idempotency keys | Purged hourly. |
| Ledger, observations, audit, payouts | Indefinite — financial and audit record. |
| Forum threads and replies | Indefinite; hidden by admins when needed but retained for moderation. Account deletion anonymises the author handle. |
| Accounts, profiles, enquiries | Indefinite until an operator removes them (no automated PII job yet). |
