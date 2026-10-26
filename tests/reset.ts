/**
 * Deterministic per-test database reset.
 *
 * The Workers Vitest integration used here does not guarantee per-test storage
 * isolation, so every test drops the schema and re-applies the real migrations.
 * That keeps the suite order-independent while still exercising the production
 * schema, triggers and constraints.
 */
import { applyD1Migrations, env } from 'cloudflare:test';
import type { D1Migration } from 'cloudflare:test';
import { testEnv } from './helpers.ts';

/** Reverse dependency order so `DROP TABLE` never trips a foreign key. */
const TABLES = [
  'd1_migrations',
  'forum_replies',
  'forum_threads',
  'notification_reads',
  'notifications',
  'support_messages',
  'support_tickets',
  'payout_allocations',
  'payouts',
  'earnings_ledger',
  'view_observations',
  'submission_reviews',
  'submissions',
  'campaign_members',
  'campaign_budget_ledger',
  'campaign_counters',
  'campaign_assets',
  'brand_report_tokens',
  'campaigns',
  'creator_campaign_zero_clips',
  'creator_profiles',
  'sessions',
  'audit_events',
  'idempotency_keys',
  'accounts',
  'enquiries',
  'rate_limits',
  'app_config',
];

export async function resetDatabase(): Promise<void> {
  // Foreign keys stay enabled in the schema, so disable enforcement for the
  // duration of the teardown only.
  await testEnv.DB.exec('PRAGMA foreign_keys = OFF;');
  try {
    for (const table of TABLES) {
      try {
        await testEnv.DB.prepare(`DROP TABLE IF EXISTS ${table}`).run();
      } catch (error) {
        throw new Error(`Failed to drop ${table}: ${(error as Error).message}`);
      }
    }
  } finally {
    await testEnv.DB.exec('PRAGMA foreign_keys = ON;');
  }
  const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;
  await applyD1Migrations(testEnv.DB, migrations);
}
