import type { Env } from './env.ts';
import { sha256Hex } from './crypto.ts';
import {
  CREATOR_INVITE_THRESHOLD,
  INVITE_CODE_TTL_DAYS,
  INVITE_CODE_TTL_MS,
  isInviteMode,
  normalizeInviteCode,
  type InviteMode,
} from '../../shared/invites.ts';

export interface InviteSettings {
  mode: InviteMode;
  threshold: number;
  creatorCount: number;
  remaining: number;
  inviteRequired: boolean;
  inviteCodeTtlDays: number;
}

/** 32 unambiguous characters; 256 is divisible by 32, so the modulo is uniform. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RANDOM_LENGTH = 12;

/** Format: MHOM-XXXX-XXXX-XXXX (60 bits of entropy). */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(CODE_RANDOM_LENGTH);
  crypto.getRandomValues(bytes);
  let body = '';
  for (const byte of bytes) body += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `MHOM-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

export function inviteCodeHint(code: string): string {
  return normalizeInviteCode(code).slice(-4);
}

export async function hashInviteCode(code: string): Promise<string> {
  return sha256Hex(normalizeInviteCode(code));
}

/**
 * Reads the live gate configuration and the current creator count. Missing or
 * malformed values fall back to the documented defaults so a bad row can never
 * accidentally open the gate.
 */
export async function getInviteSettings(env: Env): Promise<InviteSettings> {
  const configRows = await env.DB.prepare(
    `SELECT key, value FROM app_config
      WHERE key IN ('creator_invite_mode', 'creator_invite_threshold')`
  ).all<{ key: string; value: string }>();

  const config = new Map<string, string>();
  for (const row of configRows.results ?? []) {
    config.set(String(row.key), String(row.value));
  }

  const rawMode = config.get('creator_invite_mode');
  const mode: InviteMode = isInviteMode(rawMode) ? rawMode : 'auto';

  const parsedThreshold = Number.parseInt(config.get('creator_invite_threshold') ?? '', 10);
  const threshold =
    Number.isFinite(parsedThreshold) && parsedThreshold > 0
      ? Math.trunc(parsedThreshold)
      : CREATOR_INVITE_THRESHOLD;

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM accounts WHERE role = 'creator'`
  ).first<{ total: number }>();
  const creatorCount = Number(countRow?.total ?? 0);

  return {
    mode,
    threshold,
    creatorCount,
    remaining: Math.max(0, threshold - creatorCount),
    inviteRequired: mode === 'on' || (mode === 'auto' && creatorCount >= threshold),
    inviteCodeTtlDays: INVITE_CODE_TTL_DAYS,
  };
}

export { INVITE_CODE_TTL_MS };
