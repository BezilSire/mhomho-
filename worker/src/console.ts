/**
 * Operations-console path gate.
 *
 * The console shell lives at `/console/<ADMIN_PATH>`, where ADMIN_PATH is a
 * Worker secret. Keeping the comparison here makes the gate independently
 * testable and keeps the secret out of the client bundle.
 */
import { sha256Hex, timingSafeEqual } from './crypto.ts';

export const CONSOLE_PREFIX = '/console/';

function normalizeConfigured(value: string | undefined): string {
  return (value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

export async function isConfiguredConsolePath(
  pathname: string,
  configured: string | undefined
): Promise<boolean> {
  if (!pathname.startsWith(CONSOLE_PREFIX)) return false;

  const expected = normalizeConfigured(configured);
  if (!expected) return false;

  const provided = pathname.slice(CONSOLE_PREFIX.length).replace(/\/+$/, '');
  if (!provided) return false;

  // Hash both values so the comparison is constant-time and length-independent.
  const [providedHash, expectedHash] = await Promise.all([
    sha256Hex(provided),
    sha256Hex(expected),
  ]);
  return timingSafeEqual(providedHash, expectedHash);
}
