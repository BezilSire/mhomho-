/**
 * Cryptographic helpers built on the Web Crypto API available in Workers.
 * No third-party crypto dependency, no plaintext password is ever stored.
 */

const encoder = new TextEncoder();

export const PASSWORD_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toHex(new Uint8Array(digest));
}

/** Constant-time string comparison. */
export function timingSafeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.byteLength !== b.byteLength) return false;
  let mismatch = 0;
  for (let index = 0; index < a.byteLength; index += 1) {
    mismatch |= a[index] ^ b[index];
  }
  return mismatch === 0;
}

export interface PasswordRecord {
  hash: string;
  salt: string;
  iterations: number;
}

/**
 * PBKDF2-SHA256 password hashing.
 *
 * The salt is generated as 16 random bytes and stored as lowercase hex. The
 * **hex string's bytes** are always used as the PBKDF2 salt, on creation and on
 * verification, so the two paths are guaranteed to agree. (Deriving one path
 * from raw bytes and the other from the hex text silently breaks every login.)
 */
export async function hashPassword(
  password: string,
  salt?: string,
  iterations = PASSWORD_ITERATIONS
): Promise<PasswordRecord> {
  const saltHex = salt ?? toHex(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
  const saltBytes = encoder.encode(saltHex);
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS
  );
  return { hash: toHex(new Uint8Array(bits)), salt: saltHex, iterations };
}

export async function verifyPassword(
  password: string,
  record: { hash: string | null; salt: string | null; iterations: number | null }
): Promise<boolean> {
  if (!record.hash || !record.salt) return false;
  const iterations = record.iterations ?? PASSWORD_ITERATIONS;
  try {
    const candidate = await hashPassword(password, record.salt, iterations);
    return timingSafeEqual(candidate.hash, record.hash);
  } catch {
    return false;
  }
}

/**
 * Runs a dummy PBKDF2 derivation so that "unknown account" and "wrong
 * password" take a comparable amount of time.
 */
export async function dummyPasswordCheck(password: string): Promise<void> {
  try {
    await hashPassword(password, 'mhomho-timing-equaliser', PASSWORD_ITERATIONS);
  } catch {
    /* ignore */
  }
}
