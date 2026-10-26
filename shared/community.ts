/**
 * MHOMHO community constants shared by the Worker and the SPA.
 *
 * Avatars are preset keys, never uploaded files. A creator stores only a short
 * key in D1, so the feature has effectively zero object-storage cost.
 */

export const AVATAR_KEYS = [
  'sun',
  'wave',
  'leaf',
  'bolt',
  'star',
  'moon',
  'heart',
  'flower',
  'mountain',
  'orbit',
  'spark',
  'cloud',
  'flame',
  'gem',
  'paw',
  'smile',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const DEFAULT_AVATAR_KEY: AvatarKey = 'sun';

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === 'string' && (AVATAR_KEYS as readonly string[]).includes(value);
}

export function normalizeAvatarKey(value: unknown): AvatarKey {
  return isAvatarKey(value) ? value : DEFAULT_AVATAR_KEY;
}

export const FORUM_CATEGORIES = ['general', 'campaigns', 'payouts', 'wins'] as const;

export type ForumCategory = (typeof FORUM_CATEGORIES)[number];

export const FORUM_CATEGORY_LABELS: Record<ForumCategory, string> = {
  general: 'General',
  campaigns: 'Campaign help',
  payouts: 'Payouts',
  wins: 'Wins',
};

export function isForumCategory(value: unknown): value is ForumCategory {
  return typeof value === 'string' && (FORUM_CATEGORIES as readonly string[]).includes(value);
}

export type ForumThreadStatus = 'active' | 'locked' | 'hidden';

/*
 * Zimbabwe has used a fixed UTC+2 offset without daylight saving since 1903.
 * Computing the monthly leaderboard on Harare time avoids a two-hour mismatch
 * at month boundaries while keeping the SQL simple and deterministic.
 */
const HARARE_OFFSET_MS = 2 * 60 * 60 * 1000;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface MonthRange {
  key: string;
  label: string;
  start: number;
  end: number;
}

export function harareMonthRange(now = Date.now()): MonthRange {
  const shifted = new Date(now + HARARE_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const monthIndex = shifted.getUTCMonth();
  const start = Date.UTC(year, monthIndex, 1) - HARARE_OFFSET_MS;
  const end = Date.UTC(year, monthIndex + 1, 1) - HARARE_OFFSET_MS;
  return {
    key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    label: `${MONTH_NAMES[monthIndex]} ${year}`,
    start,
    end,
  };
}
