/**
 * Authentication façade for the SPA.
 *
 * Password hashing, credential checks, session issuance, CSRF and rate limits
 * all happen inside the Cloudflare Worker. The browser only receives:
 *   - an HttpOnly session cookie (unreadable from JavaScript), and
 *   - a CSRF token plus the non-secret viewer summary in `/api/bootstrap`.
 *
 * Nothing in this file compares passwords or creates tokens locally.
 */

import {
  initSession,
  loginAdmin,
  loginCreator,
  logout as apiLogout,
} from './api.ts';
import { clearSessionState, getSession, type AuthSession } from './sessionStore.ts';

export type { AuthSession, SessionRole } from './sessionStore.ts';
export { getSession } from './sessionStore.ts';

export interface AuthResult {
  success: boolean;
  error?: string;
  uid?: string;
  displayName?: string;
  status?: 'applied' | 'approved' | 'rejected' | 'suspended';
}

/** Load the server session (if any) and the anonymous campaign feed. */
export async function bootstrapSession(): Promise<AuthSession | null> {
  await initSession();
  return getSession();
}

export async function authenticateCreator(
  identifier: string,
  password: string
): Promise<AuthResult> {
  if (!identifier.trim() || !password) {
    return { success: false, error: 'Enter your email/handle and password.' };
  }

  const result = await loginCreator(identifier.trim(), password);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  if (!result.data) {
    return { success: false, error: 'The server did not return a session.' };
  }

  return {
    success: true,
    uid: result.data.uid,
    displayName: result.data.displayName ?? result.data.handle ?? undefined,
    status: result.data.status,
  };
}

export async function authenticateAdmin(email: string, password: string): Promise<AuthResult> {
  if (!email.trim() || !password) {
    return { success: false, error: 'Enter your operations email and password.' };
  }

  const result = await loginAdmin(email.trim(), password);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  if (!result.data) {
    return { success: false, error: 'The server did not return a session.' };
  }

  return {
    success: true,
    uid: result.data.uid,
    displayName: result.data.displayName ?? 'Operations',
  };
}

/**
 * Revoke the server session. The local copy is cleared even if the network
 * call fails, so the UI can never keep rendering a portal after sign-out.
 */
export async function signOut(): Promise<void> {
  try {
    await apiLogout();
  } finally {
    clearSessionState();
  }
}

/** Server-side administrator setup is authoritative; no build-time secrets. */
export function isAdminAuthConfigured(): boolean {
  return true;
}

/**
 * The Worker serves the console shell only at `/console/<ADMIN_PATH>`; the
 * secret is server-side and never shipped in this bundle. The client only
 * needs to recognise the `/console/` prefix.
 */
export function isAdminLocation(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '');
  return path.startsWith('/console/') && path.length > '/console/'.length;
}

export function clearAdminLocation(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', '/');
}
