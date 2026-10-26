/**
 * MHOMHO client read model.
 *
 * Everything here is a projection of server state. The browser never holds
 * password material, seed PII or another creator's private records, and it
 * never computes a payable amount. Mutations live in `api.ts`.
 */

import type { AvatarKey } from '../../shared/community.ts';

export type CreatorStatus = 'applied' | 'approved' | 'rejected' | 'suspended';

export const CAMPAIGN_ZERO_MIN_CLIPS = 3;
export const CAMPAIGN_ZERO_MIN_VIEWS = 1000;

export interface CampaignZeroClip {
  url: string;
  claimedViews: number;
  addedAt: string;
}

export interface CampaignZeroState {
  followConfirmed: boolean;
  clips: CampaignZeroClip[];
  submittedAt?: string;
  verifiedAt?: string;
}

export interface CreatorPublicDoc {
  uid: string;
  handle: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  niche: string;
  followers: number;
  /** Preset avatar key; never an uploaded image. */
  avatarKey?: AvatarKey;
  status: CreatorStatus;
  createdAt: string;
  campaignZero?: CampaignZeroState;
}

export interface CreatorPrivateDoc {
  uid: string;
  name: string;
  email?: string;
  whatsappNumber: string;
  ecoCashNumber: string;
  /** Country inferred from the WhatsApp dialling code (admin-only). */
  country?: string;
  countryCode?: string;
}

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'closing'
  | 'completed'
  | 'cancelled';

export interface CampaignLifecycle {
  status: CampaignStatus;
  acceptingJoins: boolean;
  acceptingSubmissions: boolean;
  accumulatingViews: boolean;
  inSettlement: boolean;
  label: string;
  creatorHint: string;
}

export interface CampaignDoc {
  id: string;
  slug: string;
  title: string;
  brandName: string;
  niche: string;
  brief: string;
  requiredContent?: string | null;
  eligibility?: string | null;
  hookIdeas: string[];
  doNots: string[];
  brandAssetUrl?: string | null;
  posterUrl?: string | null;
  status: CampaignStatus;
  lifecycle: CampaignLifecycle;
  currency: 'USD';
  budgetCents: number;
  creatorPoolCents: number;
  brandCpmCents: number;
  creatorCpmCents: number;
  perPostCapCents: number | null;
  qualifyingViewThreshold: number;
  startsAt: number | null;
  joiningCutoffAt: number | null;
  submissionCutoffAt: number | null;
  viewsCutoffAt: number | null;
  endDate: string;
  endsAt: number | null;
  daysLeft: number;
  termsVersion: number;
  settledAt: number | null;
}

export interface CampaignStatsDoc {
  id: string;
  budgetCents: number;
  poolTotalCents: number;
  poolUsedCents: number;
  poolRemainingCents: number;
  paidCents: number;
  shortfallCents: number;
  joinedCount: number;
  clipsLive: number;
  verifiedViews: number;
  eligibleViews: number;
  joiningOpen: boolean;
  acceptingSubmissions: boolean;
  acceptingViews: boolean;
  poolUsePercent: number;
  updatedAt: number | null;
}

export interface CampaignFinanceDoc {
  id: string;
  budgetCents: number;
  brandPricePerThousandCents: number;
  creatorRatePerThousandCents: number;
  perPostCapCents: number | null;
  currency: 'USD';
}

export interface CampaignMemberDoc {
  id: string;
  campaignId: string;
  creatorUid: string;
  joinedAt: string;
  joinedAtMs?: number;
}

/** Public-safe activity event returned by `GET /api/activity`. */
export interface ActivityItem {
  id: string;
  type: 'signup' | 'join';
  at: number;
  firstName: string;
  handle: string | null;
  platform: string;
  campaignId: string | null;
  campaignTitle: string | null;
  uid: string | null;
}

/** Admin-only joiner row returned by `GET /api/admin/campaigns/:id/members`. */
export interface CampaignMemberDetail {
  uid: string;
  handle: string;
  displayName: string;
  platform: string;
  niche: string;
  followers: number;
  accountStatus: string;
  joinedAtMs: number;
  clipsSubmitted: number;
  verifiedViews: number;
  earnedCents: number;
}

export type ClipStatus = 'submitted' | 'approved' | 'verified' | 'rejected' | 'withdrawn';

export interface ClipDoc {
  id: string;
  campaignId: string;
  creatorUid: string;
  creatorHandle: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  link: string;
  screenshotUrl: string;
  proofAssetId: string | null;
  claimedViews: number;
  publicViews: number;
  verifiedViews: number;
  eligibleViews: number;
  averageViews: number;
  status: ClipStatus;
  flagged: boolean;
  spikeReason?: string | null;
  earningsCents: number;
  shortfallCents: number;
  reviewNote?: string | null;
  createdAt: string;
  verifiedAt?: string | null;
  updatedAt: number;
}

export interface LedgerDoc {
  id: string;
  creatorUid: string;
  clipId?: string;
  campaignId?: string;
  amountCents: number;
  type: 'earned' | 'paid' | 'adjustment';
  entryType?: string;
  description: string;
  createdAt: string;
  createdAtMs?: number;
}

export type PayoutStatus =
  | 'requested'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

export interface PayoutDoc {
  id: string;
  creatorUid: string;
  creatorName: string;
  ecoCashNumber: string;
  amountCents: number;
  status: PayoutStatus;
  method?: string;
  paidDate?: string;
  reference?: string;
  failureReason?: string;
  createdAt: string;
}

export interface BrandViewDoc {
  token: string;
  campaignId: string;
  title: string;
  brandName: string;
  status?: CampaignStatus;
  verifiedViews: number;
  eligibleViews?: number;
  guaranteedViews: number;
  budgetUsedCents: number;
  budgetCents: number;
  creatorsJoined: number;
  clipsLive: number;
  viewsSeries: { label: string; value: number }[];
  reportSummary: string;
}

export interface EnquiryDoc {
  id: string;
  bizName: string;
  contactName: string;
  phone: string;
  niche: string;
  promo: string;
  goals: string[];
  budget: string;
  start: string;
  notes?: string;
  bestTimes?: string[];
  createdAt: string;
  status: 'new' | 'contacted' | 'booked' | 'closed';
}

export type UserRole = 'creator' | 'admin' | 'business';

export interface Viewer {
  uid: string;
  role: UserRole;
  status: CreatorStatus;
  handle: string | null;
  displayName: string | null;
  email: string;
  balances: {
    earnedCents: number;
    paidCents: number;
    owedCents: number;
    reservedCents: number;
  };
}

export interface DatabaseState {
  generatedAt: number;
  currency: 'USD';
  viewer: Viewer | null;
  csrfToken: string | null;
  sessionExpiresAt: number | null;
  creatorsPublic: Record<string, CreatorPublicDoc>;
  creatorsPrivate: Record<string, CreatorPrivateDoc>;
  campaigns: Record<string, CampaignDoc>;
  campaignFinance: Record<string, CampaignFinanceDoc>;
  campaignStats: Record<string, CampaignStatsDoc>;
  campaignMembers: Record<string, CampaignMemberDoc>;
  clips: Record<string, ClipDoc>;
  ledger: Record<string, LedgerDoc>;
  payouts: Record<string, PayoutDoc>;
  brandViews: Record<string, BrandViewDoc>;
  enquiries: Record<string, EnquiryDoc>;
  totals: {
    owedCents: number;
    earnedCents: number;
    paidCents: number;
    formattedOwed: string;
  } | null;
}

export function emptyDatabaseState(): DatabaseState {
  return {
    generatedAt: 0,
    currency: 'USD',
    viewer: null,
    csrfToken: null,
    sessionExpiresAt: null,
    creatorsPublic: {},
    creatorsPrivate: {},
    campaigns: {},
    campaignFinance: {},
    campaignStats: {},
    campaignMembers: {},
    clips: {},
    ledger: {},
    payouts: {},
    brandViews: {},
    enquiries: {},
    totals: null,
  };
}

/* ------------------------------------------------------------------ */
/* Reactive store                                                      */
/* ------------------------------------------------------------------ */

type Listener = () => void;
const listeners = new Set<Listener>();

let currentState: DatabaseState = emptyDatabaseState();

export function subscribeToDatabase(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDatabaseState(): DatabaseState {
  return currentState;
}

export function setDatabaseState(state: DatabaseState): void {
  currentState = state;
  listeners.forEach((listener) => listener());
}

/** Merge a partial server projection without dropping unrelated slices. */
export function applyProjection(payload: Partial<DatabaseState>): void {
  currentState = {
    ...currentState,
    ...payload,
    creatorsPublic: payload.creatorsPublic ?? currentState.creatorsPublic,
    creatorsPrivate: payload.creatorsPrivate ?? currentState.creatorsPrivate,
    campaigns: payload.campaigns ?? currentState.campaigns,
    campaignFinance: payload.campaignFinance ?? currentState.campaignFinance,
    campaignStats: payload.campaignStats ?? currentState.campaignStats,
    campaignMembers: payload.campaignMembers ?? currentState.campaignMembers,
    clips: payload.clips ?? currentState.clips,
    ledger: payload.ledger ?? currentState.ledger,
    payouts: payload.payouts ?? currentState.payouts,
    brandViews: payload.brandViews ?? currentState.brandViews,
    enquiries: payload.enquiries ?? currentState.enquiries,
    totals: payload.totals ?? currentState.totals,
  };
  listeners.forEach((listener) => listener());
}

/* ------------------------------------------------------------------ */
/* Read-only helpers                                                   */
/* ------------------------------------------------------------------ */

export const SOCIAL_HOSTS = [
  'tiktok.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'fb.watch',
] as const;

/** Client-side affordance only. The Worker re-validates every URL. */
export function isAllowedSocialUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    return SOCIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export interface CampaignZeroEvaluation {
  followed: boolean;
  clipCount: number;
  maxViews: number;
  hasQualifyingClip: boolean;
  submitted: boolean;
  complete: boolean;
}

export function evaluateCampaignZero(
  campaignZero: CampaignZeroState | undefined
): CampaignZeroEvaluation {
  const clips = campaignZero?.clips ?? [];
  const validClips = clips.filter((clip) => isAllowedSocialUrl(clip.url));
  const maxViews = validClips.reduce(
    (max, clip) => Math.max(max, Number.isFinite(clip.claimedViews) ? clip.claimedViews : 0),
    0
  );
  const followed = Boolean(campaignZero?.followConfirmed);
  const clipCount = validClips.length;
  return {
    followed,
    clipCount,
    maxViews,
    hasQualifyingClip: maxViews >= CAMPAIGN_ZERO_MIN_VIEWS,
    submitted: Boolean(campaignZero?.submittedAt),
    complete:
      followed && clipCount >= CAMPAIGN_ZERO_MIN_CLIPS && maxViews >= CAMPAIGN_ZERO_MIN_VIEWS,
  };
}

export function calculateCreatorBalances(creatorUid: string) {
  let earnedCents = 0;
  let paidCents = 0;
  let reservedCents = 0;

  for (const entry of Object.values(currentState.ledger)) {
    if (entry.creatorUid !== creatorUid) continue;
    if (entry.type === 'paid') paidCents += Math.abs(entry.amountCents);
    else earnedCents += entry.amountCents;
  }

  for (const payout of Object.values(currentState.payouts)) {
    if (payout.creatorUid !== creatorUid) continue;
    if (
      payout.status === 'requested' ||
      payout.status === 'approved' ||
      payout.status === 'processing'
    ) {
      reservedCents += payout.amountCents;
    }
  }

  return {
    earnedCents,
    paidCents,
    reservedCents,
    owedCents: Math.max(0, earnedCents - paidCents - reservedCents),
  };
}

export function calculateTotalOwedCents(): number {
  let totalEarned = 0;
  let totalPaid = 0;
  let totalReserved = 0;

  for (const entry of Object.values(currentState.ledger)) {
    if (entry.type === 'paid') totalPaid += Math.abs(entry.amountCents);
    else totalEarned += entry.amountCents;
  }

  for (const payout of Object.values(currentState.payouts)) {
    if (
      payout.status === 'requested' ||
      payout.status === 'approved' ||
      payout.status === 'processing'
    ) {
      totalReserved += payout.amountCents;
    }
  }

  return Math.max(0, totalEarned - totalPaid - totalReserved);
}

export function isCampaignOpenToJoins(campaign: CampaignDoc, stats?: CampaignStatsDoc): boolean {
  if (!stats) return campaign.lifecycle?.acceptingJoins ?? false;
  return Boolean(stats.joiningOpen) && campaign.lifecycle?.acceptingJoins !== false;
}

export function campaignStatusLabel(campaign: CampaignDoc): string {
  return campaign.lifecycle?.label ?? campaign.status;
}
