import { getDatabaseState, UserRole } from './firebase.ts';

/**
 * Lightweight auth for the local demo.
 *
 * Production note: this app currently persists its database in localStorage,
 * so client-side checks are a UX and code-organization boundary, not a hard
 * security boundary. A real deployment must move authentication, password
 * hashing, session issuance and admin approval to Firebase Auth / a server.
 * Nothing in this module is a substitute for that.
 */

const SESSION_KEY = 'mhomho_session_v1';
const THROTTLE_KEY = 'mhomho_auth_throttle_v1';

const CREATOR_SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours
const ADMIN_SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const LOCKOUT = 15 * 60 * 1000;
const PASSWORD_ITERATIONS = 120_000;

export type SessionRole = Extract<UserRole, 'creator' | 'admin'>;

export interface AuthSession {
  role: SessionRole;
  uid: string;
  identifier: string;
  token: string;
  issuedAt: number;
  expiresAt: number;
}

interface ThrottleRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  uid?: string;
  displayName?: string;
  status?: 'applied' | 'approved' | 'rejected';
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function randomToken(): string {
  try {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random()
      .toString(36)
      .slice(2)}_${Math.random().toString(36).slice(2)}`;
  }
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure hashing is unavailable in this browser context.');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const digest = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createSalt(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  }
}

export function createSession(
  role: SessionRole,
  uid: string,
  identifier: string
): AuthSession {
  const issuedAt = Date.now();
  return {
    role,
    uid,
    identifier,
    token: randomToken(),
    issuedAt,
    expiresAt: issuedAt + (role === 'admin' ? ADMIN_SESSION_TTL : CREATOR_SESSION_TTL),
  };
}

export function saveSession(session: AuthSession): void {
  safeStorage()?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  safeStorage()?.removeItem(SESSION_KEY);
}

export function getSession(): AuthSession | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      (parsed.role !== 'creator' && parsed.role !== 'admin') ||
      typeof parsed.uid !== 'string' ||
      typeof parsed.identifier !== 'string' ||
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.token.length < 32 ||
      parsed.expiresAt <= Date.now()
    ) {
      clearSession();
      return null;
    }
    return parsed as AuthSession;
  } catch {
    clearSession();
    return null;
  }
}

function readThrottle(scope: string): ThrottleRecord {
  const storage = safeStorage();
  if (!storage) return { count: 0, firstAttemptAt: 0, lockedUntil: 0 };
  try {
    const raw = storage.getItem(`${THROTTLE_KEY}:${scope}`);
    if (!raw) return { count: 0, firstAttemptAt: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw) as Partial<ThrottleRecord>;
    return {
      count: Number(parsed.count) || 0,
      firstAttemptAt: Number(parsed.firstAttemptAt) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    };
  } catch {
    return { count: 0, firstAttemptAt: 0, lockedUntil: 0 };
  }
}

function writeThrottle(scope: string, record: ThrottleRecord): void {
  safeStorage()?.setItem(`${THROTTLE_KEY}:${scope}`, JSON.stringify(record));
}

export function throttleStatus(scope: string): { locked: boolean; retryAfterSeconds: number } {
  const record = readThrottle(scope);
  const now = Date.now();
  if (record.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)),
    };
  }
  if (record.firstAttemptAt && now - record.firstAttemptAt > ATTEMPT_WINDOW) {
    writeThrottle(scope, { count: 0, firstAttemptAt: 0, lockedUntil: 0 });
  }
  return { locked: false, retryAfterSeconds: 0 };
}

function recordFailure(scope: string): { locked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = readThrottle(scope);
  const withinWindow =
    existing.firstAttemptAt > 0 && now - existing.firstAttemptAt <= ATTEMPT_WINDOW;
  const next: ThrottleRecord = withinWindow
    ? { ...existing, count: existing.count + 1 }
    : { count: 1, firstAttemptAt: now, lockedUntil: 0 };

  if (next.count >= MAX_ATTEMPTS) {
    next.lockedUntil = now + LOCKOUT;
  }
  writeThrottle(scope, next);

  return {
    locked: next.lockedUntil > now,
    retryAfterSeconds: Math.max(0, Math.ceil((next.lockedUntil - now) / 1000)),
  };
}

function failureMessage(scope: string, result: { locked: boolean; retryAfterSeconds: number }): string {
  if (result.locked) {
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }
  return scope === 'admin'
    ? 'Access denied. Check your credentials and try again.'
    : 'Email/handle or password is incorrect.';
}

function clearThrottle(scope: string): void {
  safeStorage()?.removeItem(`${THROTTLE_KEY}:${scope}`);
}

function normalizedIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, '');
}

export async function authenticateCreator(
  identifier: string,
  password: string
): Promise<AuthResult> {
  const throttle = throttleStatus('creator');
  if (throttle.locked) {
    return { success: false, error: failureMessage('creator', throttle) };
  }

  const query = normalizedIdentifier(identifier);
  if (!query || !password) {
    return { success: false, error: 'Enter your email/handle and password.' };
  }

  const state = getDatabaseState();
  const match = Object.values(state.creatorsPublic).find((creator) => {
    const privateDoc = state.creatorsPrivate[creator.uid];
    const handle = normalizedIdentifier(creator.handle);
    const email = privateDoc?.email ? normalizedIdentifier(privateDoc.email) : '';
    return handle === query || (email.length > 0 && email === query);
  });

  if (!match) {
    const failure = recordFailure('creator');
    return { success: false, error: failureMessage('creator', failure) };
  }

  const privateDoc = state.creatorsPrivate[match.uid];
  if (!privateDoc?.passwordSalt || !privateDoc.passwordHash) {
    const failure = recordFailure('creator');
    return { success: false, error: failureMessage('creator', failure) };
  }

  let candidateHash = '';
  try {
    candidateHash = await hashPassword(password, privateDoc.passwordSalt);
  } catch {
    return { success: false, error: 'Secure sign-in is unavailable. Open the app on localhost or HTTPS.' };
  }

  if (!safeEqual(candidateHash, privateDoc.passwordHash)) {
    const failure = recordFailure('creator');
    return { success: false, error: failureMessage('creator', failure) };
  }

  clearThrottle('creator');
  return {
    success: true,
    uid: match.uid,
    displayName: privateDoc.name,
    status: match.status,
  };
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_ADMIN_EMAIL &&
      import.meta.env.VITE_ADMIN_PASSWORD_SALT &&
      import.meta.env.VITE_ADMIN_PASSWORD_HASH
  );
}

export async function authenticateAdmin(email: string, password: string): Promise<AuthResult> {
  const throttle = throttleStatus('admin');
  if (throttle.locked) {
    return { success: false, error: failureMessage('admin', throttle) };
  }

  if (!isAdminAuthConfigured()) {
    return {
      success: false,
      error: 'Access is not configured on this deployment.',
    };
  }

  const expectedEmail = String(import.meta.env.VITE_ADMIN_EMAIL).trim().toLowerCase();
  const adminSalt = String(import.meta.env.VITE_ADMIN_PASSWORD_SALT);
  const adminHash = String(import.meta.env.VITE_ADMIN_PASSWORD_HASH);
  const candidateEmail = email.trim().toLowerCase();

  let candidateHash = '';
  try {
    candidateHash = await hashPassword(password, adminSalt);
  } catch {
    return { success: false, error: 'Secure sign-in is unavailable. Open the app on localhost or HTTPS.' };
  }

  const emailMatches = safeEqual(candidateEmail, expectedEmail);
  const passwordMatches = safeEqual(candidateHash, adminHash);

  if (!emailMatches || !passwordMatches) {
    const failure = recordFailure('admin');
    return { success: false, error: failureMessage('admin', failure) };
  }

  clearThrottle('admin');
  return { success: true, uid: 'admin_uid', displayName: 'Operations' };
}

export function getAdminPath(): string {
  const configured = String(import.meta.env.VITE_ADMIN_PATH || 'ops-7f3a2c').trim();
  return configured.replace(/^#?\/+/, '').replace(/\/+$/, '');
}

export function isAdminLocation(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  return hash === getAdminPath();
}

export function clearAdminLocation(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}
