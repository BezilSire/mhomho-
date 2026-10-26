/**
 * In-memory session state for the SPA.
 *
 * The real session lives in an HttpOnly cookie that JavaScript cannot read.
 * This module only keeps the non-secret view of that session (role, uid,
 * display identifier, expiry) plus the CSRF token that the server returns in
 * the bootstrap payload. Nothing here is persisted to localStorage or
 * sessionStorage, so closing the tab ends the client-side copy.
 */

import type { Viewer } from './firebase.ts';

export type SessionRole = Extract<Viewer['role'], 'creator' | 'admin'>;

export interface AuthSession {
  role: SessionRole;
  uid: string;
  identifier: string;
  expiresAt: number;
}

type Listener = () => void;

let currentSession: AuthSession | null = null;
let currentCsrfToken: string | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSession(): AuthSession | null {
  if (currentSession && currentSession.expiresAt <= Date.now()) {
    currentSession = null;
    currentCsrfToken = null;
    return null;
  }
  return currentSession;
}

export function getCsrfToken(): string | null {
  return currentCsrfToken;
}

/**
 * Replace the cached session from a server bootstrap payload. A null viewer
 * means the request was anonymous, so everything is cleared.
 */
export function setSessionFromBootstrap(
  viewer: Viewer | null,
  csrfToken: string | null,
  sessionExpiresAt: number | null
): void {
  if (!viewer || (viewer.role !== 'creator' && viewer.role !== 'admin')) {
    currentSession = null;
    currentCsrfToken = null;
    emit();
    return;
  }

  currentSession = {
    role: viewer.role,
    uid: viewer.uid,
    identifier: viewer.handle ?? viewer.email,
    expiresAt: sessionExpiresAt ?? 0,
  };
  currentCsrfToken = csrfToken;
  emit();
}

export function clearSessionState(): void {
  currentSession = null;
  currentCsrfToken = null;
  emit();
}

export function isSessionExpired(session: AuthSession | null): boolean {
  return !session || session.expiresAt <= Date.now();
}
