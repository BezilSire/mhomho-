/**
 * Global test setup: reset the schema and re-apply the real D1 migrations
 * before every test so no test depends on another test's data.
 */
import { beforeEach } from 'vitest';
import { applyD1Migrations, env } from 'cloudflare:test';
import type { D1Migration } from 'cloudflare:test';
import { resetDatabase } from './reset.ts';

const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;

if (!Array.isArray(migrations) || migrations.length === 0) {
  throw new Error('TEST_MIGRATIONS binding is missing: vitest.config.ts did not load migrations.');
}

// Establish the schema once for the file (and for any test that runs before the
// first beforeEach hook).
const db = (env as unknown as { DB: D1Database }).DB;
await applyD1Migrations(db, migrations);

beforeEach(async () => {
  await resetDatabase();
});
