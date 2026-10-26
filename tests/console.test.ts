/**
 * Operations-console path gate.
 *
 * The shell must only be served at the configured secret path; every other
 * `/console/*` request is a non-indexable 404. The secret is a Worker binding,
 * not a client build variable.
 */
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { isConfiguredConsolePath } from '../worker/src/console.ts';

const SECRET = 'ops-test-console-7f3a2c';

describe('operations console path gate', () => {
  it('accepts only the exact configured secret', async () => {
    await expect(isConfiguredConsolePath(`/console/${SECRET}`, SECRET)).resolves.toBe(true);
    await expect(isConfiguredConsolePath(`/console/${SECRET}/`, SECRET)).resolves.toBe(true);
    await expect(isConfiguredConsolePath('/console/wrong', SECRET)).resolves.toBe(false);
    await expect(isConfiguredConsolePath('/console/', SECRET)).resolves.toBe(false);
    await expect(isConfiguredConsolePath(`/console/${SECRET}`, undefined)).resolves.toBe(false);
    await expect(isConfiguredConsolePath(`/console/${SECRET}`, '')).resolves.toBe(false);
  });

  it('returns a non-indexable 404 for an incorrect or empty path', async () => {
    for (const path of ['/console/wrong', '/console/', '/console/ops-test-console']) {
      const response = await SELF.fetch(new Request(`https://mhomho.test${path}`));
      expect(response.status).toBe(404);
      expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });
});
