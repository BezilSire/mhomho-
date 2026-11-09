/**
 * Creator invite gate.
 *
 * Sign-up is open by default. Once the roster reaches the threshold (3,000
 * creator accounts), every new creator must present a single-use invite code.
 * An administrator can also force invite-only mode early, or switch it off.
 */

export const CREATOR_INVITE_THRESHOLD = 3000;
export const INVITE_CODE_TTL_DAYS = 30;
export const INVITE_CODE_TTL_MS = INVITE_CODE_TTL_DAYS * 86_400_000;

export type InviteMode = 'auto' | 'on' | 'off';

export const INVITE_MODES: readonly InviteMode[] = ['auto', 'on', 'off'];

export function isInviteMode(value: unknown): value is InviteMode {
  return value === 'auto' || value === 'on' || value === 'off';
}

/**
 * Canonical form used for hashing and comparison. Users may paste the code with
 * spaces, lower-case letters or no dashes; all of those resolve to the same
 * value, so a code is never rejected for cosmetic reasons.
 */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
