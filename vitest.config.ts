import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests run inside the real Workers runtime (workerd) with real
 * local D1 and R2 bindings supplied by Miniflare, so triggers, foreign keys and
 * the append-only ledger are exercised exactly as they are in production.
 *
 * `readD1Migrations` runs in Node during config evaluation; the resulting
 * migrations are handed to the Worker runtime as the TEST_MIGRATIONS binding
 * and applied by tests/setup.ts before each test file.
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ADMIN_SETUP_TOKEN: 'test-admin-setup-token-value-0001',
            ADMIN_PATH: 'ops-test-console-7f3a2c',
          },
        },
      }),
    ],
    test: {
      include: ['tests/**/*.test.ts'],
      setupFiles: ['./tests/setup.ts'],
      // Workerd start-up and PBKDF2-heavy auth tests are slower than a plain
      // Node test run. The suite runs files in parallel, so keep enough headroom
      // for a throttling test that performs several real password hashes.
      testTimeout: 60_000,
      hookTimeout: 30_000,
    },
  };
});
