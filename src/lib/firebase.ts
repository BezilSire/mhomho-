/**
 * Mhomho Media - Firebase Data Layer & Simulated Cloud Functions
 * Follows Sections 5, 6, 7, 8 of Build Guide:
 * - creators/{uid}
 * - creatorsPrivate/{uid}
 * - campaigns/{id}
 * - campaignStats/{id}
 * - campaignFinance/{id}
 * - campaignMembers/{campaignId}_{uid}
 * - clips/{id}
 * - ledger/{id}
 * - payouts/{id}
 * - brandViews/{token}
 * - enquiries/{id}
 * - Cloud Functions: approveCreator, joinCampaign, verifyClip (transactional), markPaid
 */

import {
  calculateCreatorPool,
  calculatePerPostCap,
  calculateGuaranteedViews,
  calculateClipEarnings,
  isJoiningClosed,
  DEFAULT_MONEY_CONFIG,
} from './money.ts';

// Document Schemas
export type CreatorStatus = 'applied' | 'approved' | 'rejected';

export interface CreatorPublicDoc {
  uid: string;
  handle: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  niche: string;
  followers: number;
  status: CreatorStatus;
  createdAt: string;
}

export interface CreatorPrivateDoc {
  uid: string;
  name: string;
  whatsappNumber: string;
  ecoCashNumber: string;
}

export interface CampaignDoc {
  id: string;
  title: string;
  brandName: string;
  niche: string;
  brief: string;
  hookIdeas: string[];
  doNots: string[];
  status: 'open' | 'closed' | 'full';
  endDate: string;
  daysLeft: number;
}

export interface CampaignStatsDoc {
  id: string; // matches campaignId
  poolTotalCents: number;
  poolUsedCents: number;
  joinedCount: number;
  clipsLive: number;
  verifiedViews: number;
  joiningOpen: boolean;
}

export interface CampaignFinanceDoc {
  id: string; // matches campaignId
  budgetCents: number;
  brandPricePerThousandCents: number;
  creatorRatePerThousandCents: number;
  perPostCapCents: number;
}

export interface CampaignMemberDoc {
  id: string; // `${campaignId}_${creatorUid}`
  campaignId: string;
  creatorUid: string;
  joinedAt: string;
}

export type ClipStatus = 'submitted' | 'verified' | 'rejected' | 'clawedBack';

export interface ClipDoc {
  id: string;
  campaignId: string;
  creatorUid: string;
  creatorHandle: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  link: string;
  screenshotUrl: string;
  claimedViews: number;
  publicViews: number;
  verifiedViews: number;
  averageViews: number;
  status: ClipStatus;
  flagged: boolean;
  spikeReason?: string;
  createdAt: string;
  verifiedAt?: string;
  earningsCents?: number;
}

export interface LedgerDoc {
  id: string;
  creatorUid: string;
  clipId?: string;
  amountCents: number;
  type: 'earned' | 'paid' | 'adjustment';
  description: string;
  createdAt: string;
}

export interface PayoutDoc {
  id: string;
  creatorUid: string;
  creatorName: string;
  ecoCashNumber: string;
  amountCents: number;
  status: 'pending' | 'paid';
  paidDate?: string;
  reference?: string;
  createdAt: string;
}

export interface BrandViewDoc {
  token: string;
  campaignId: string;
  title: string;
  brandName: string;
  verifiedViews: number;
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
  status: 'new' | 'contacted' | 'booked';
}

// User Auth Representation
export type UserRole = 'creator' | 'admin';

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  creatorStatus?: CreatorStatus;
}

// Initial Mock Seed Data matching mhomho-app-screens.html
const SEED_CREATORS_PUBLIC: Record<string, CreatorPublicDoc> = {
  tendai_uid: {
    uid: 'tendai_uid',
    handle: '@tendai_tech',
    platform: 'TikTok',
    niche: 'Tech & gadgets',
    followers: 18500,
    status: 'approved',
    createdAt: '2026-09-15',
  },
  rue_uid: {
    uid: 'rue_uid',
    handle: '@glow_with_rue',
    platform: 'Instagram',
    niche: 'Health & beauty',
    followers: 24000,
    status: 'approved',
    createdAt: '2026-09-20',
  },
  tafara_uid: {
    uid: 'tafara_uid',
    handle: '@fitwithtafara',
    platform: 'TikTok',
    niche: 'Fitness',
    followers: 12000,
    status: 'approved',
    createdAt: '2026-10-01',
  },
  newbie_uid: {
    uid: 'newbie_uid',
    handle: '@kudzai_vibe',
    platform: 'TikTok',
    niche: 'Entertainment & events',
    followers: 3200,
    status: 'applied',
    createdAt: '2026-10-18',
  },
};

const SEED_CREATORS_PRIVATE: Record<string, CreatorPrivateDoc> = {
  tendai_uid: {
    uid: 'tendai_uid',
    name: 'Tendai Moyo',
    whatsappNumber: '+263 77 123 4567',
    ecoCashNumber: '+263 77 000 0000',
  },
  rue_uid: {
    uid: 'rue_uid',
    name: 'Ruvimbo Ndlovu',
    whatsappNumber: '+263 78 654 3210',
    ecoCashNumber: '+263 78 111 2222',
  },
  tafara_uid: {
    uid: 'tafara_uid',
    name: 'Tafara Chidzero',
    whatsappNumber: '+263 71 999 8888',
    ecoCashNumber: '+263 71 333 4444',
  },
  newbie_uid: {
    uid: 'newbie_uid',
    name: 'Kudzai Marume',
    whatsappNumber: '+263 77 444 5555',
    ecoCashNumber: '+263 77 555 6666',
  },
};

const SEED_CAMPAIGNS: Record<string, CampaignDoc> = {
  glow_skincare: {
    id: 'glow_skincare',
    title: 'Glow Skincare Launch',
    brandName: 'Glow Beauty Labs',
    niche: 'Health & beauty',
    brief: 'Show your real morning routine and mention Glow in the first 3 seconds. One clear shot of the product.',
    hookIdeas: [
      '“I swapped my whole routine for 7 days”',
      '“Why my skin changed in Harare’s dry season”',
      '“3 products I actually finished this month”',
    ],
    doNots: [
      'Buy views or engage in view pods.',
      'Delete the clip within 30 days.',
      'Post from someone else’s account.',
    ],
    status: 'open',
    endDate: '2026-10-26',
    daysLeft: 6,
  },
  zuva_bundles: {
    id: 'zuva_bundles',
    title: 'Zuva Data Bundles',
    brandName: 'Zuva Telecom',
    niche: 'Tech & gadgets',
    brief: 'Highlight the overnight unlimited bundle speed and show downloading an entire playlist or app update in seconds.',
    hookIdeas: [
      '“How I save $20 on data every week in Zimbabwe”',
      '“The bundle nobody is talking about”',
    ],
    doNots: [
      'Do not display illegal downloads.',
      'Do not badmouth competitors by name.',
    ],
    status: 'full',
    endDate: '2026-10-22',
    daysLeft: 2,
  },
  bulawayo_fit: {
    id: 'bulawayo_fit',
    title: 'Bulawayo Fit Week',
    brandName: 'Vitality Gyms',
    niche: 'Fitness',
    brief: 'Share your 20-minute bodyweight routine and tag Bulawayo Fit Week with the official discount code.',
    hookIdeas: [
      '“Stop skipping leg day: try this 10 min burner”',
      '“Bulawayo what’s our excuse this Monday?”',
    ],
    doNots: ['No unsafe workout form advice without disclaimers.'],
    status: 'open',
    endDate: '2026-10-29',
    daysLeft: 9,
  },
};

const SEED_CAMPAIGN_FINANCE: Record<string, CampaignFinanceDoc> = {
  glow_skincare: {
    id: 'glow_skincare',
    budgetCents: 25000, // $250.00
    brandPricePerThousandCents: 150,
    creatorRatePerThousandCents: 100,
    perPostCapCents: 4166, // 25% of 16,666
  },
  zuva_bundles: {
    id: 'zuva_bundles',
    budgetCents: 35000, // $350.00
    brandPricePerThousandCents: 150,
    creatorRatePerThousandCents: 100,
    perPostCapCents: 5833,
  },
  bulawayo_fit: {
    id: 'bulawayo_fit',
    budgetCents: 20000, // $200.00
    brandPricePerThousandCents: 150,
    creatorRatePerThousandCents: 100,
    perPostCapCents: 3333,
  },
};

const SEED_CAMPAIGN_STATS: Record<string, CampaignStatsDoc> = {
  glow_skincare: {
    id: 'glow_skincare',
    poolTotalCents: 16666, // 2/3 of 25,000
    poolUsedCents: 10666, // 64% full
    joinedCount: 31,
    clipsLive: 74,
    verifiedViews: 112400,
    joiningOpen: true,
  },
  zuva_bundles: {
    id: 'zuva_bundles',
    poolTotalCents: 23333,
    poolUsedCents: 23333, // 100% full
    joinedCount: 52,
    clipsLive: 88,
    verifiedViews: 233330,
    joiningOpen: false,
  },
  bulawayo_fit: {
    id: 'bulawayo_fit',
    poolTotalCents: 13333,
    poolUsedCents: 5466, // 41% full
    joinedCount: 18,
    clipsLive: 29,
    verifiedViews: 54660,
    joiningOpen: true,
  },
};

const SEED_CAMPAIGN_MEMBERS: Record<string, CampaignMemberDoc> = {
  glow_skincare_tendai_uid: {
    id: 'glow_skincare_tendai_uid',
    campaignId: 'glow_skincare',
    creatorUid: 'tendai_uid',
    joinedAt: '2026-10-14',
  },
  bulawayo_fit_tendai_uid: {
    id: 'bulawayo_fit_tendai_uid',
    campaignId: 'bulawayo_fit',
    creatorUid: 'tendai_uid',
    joinedAt: '2026-10-15',
  },
};

const SEED_CLIPS: Record<string, ClipDoc> = {
  clip_tendai_1: {
    id: 'clip_tendai_1',
    campaignId: 'glow_skincare',
    creatorUid: 'tendai_uid',
    creatorHandle: '@tendai_tech',
    platform: 'TikTok',
    link: 'https://tiktok.com/@tendai_tech/video/710001',
    screenshotUrl: '/assets/screenshots/clip1.jpg',
    claimedViews: 8200,
    publicViews: 8200,
    verifiedViews: 8200,
    averageViews: 4500,
    status: 'verified',
    flagged: false,
    createdAt: '2026-10-15',
    verifiedAt: '2026-10-16',
    earningsCents: 820,
  },
  clip_tendai_2: {
    id: 'clip_tendai_2',
    campaignId: 'bulawayo_fit',
    creatorUid: 'tendai_uid',
    creatorHandle: '@tendai_tech',
    platform: 'TikTok',
    link: 'https://tiktok.com/@tendai_tech/video/710002',
    screenshotUrl: '/assets/screenshots/clip2.jpg',
    claimedViews: 14500,
    publicViews: 14500,
    verifiedViews: 14500,
    averageViews: 4500,
    status: 'verified',
    flagged: false,
    createdAt: '2026-10-16',
    verifiedAt: '2026-10-17',
    earningsCents: 1450,
  },
  clip_tendai_3: {
    id: 'clip_tendai_3',
    campaignId: 'glow_skincare',
    creatorUid: 'tendai_uid',
    creatorHandle: '@tendai_tech',
    platform: 'Instagram',
    link: 'https://instagram.com/p/C0987654',
    screenshotUrl: '/assets/screenshots/clip3.jpg',
    claimedViews: 2100,
    publicViews: 2050,
    verifiedViews: 0,
    averageViews: 4500,
    status: 'rejected',
    flagged: false,
    createdAt: '2026-10-18',
  },
  // In verification queue
  clip_queue_1: {
    id: 'clip_queue_1',
    campaignId: 'glow_skincare',
    creatorUid: 'tendai_uid',
    creatorHandle: '@tendai_tech',
    platform: 'TikTok',
    link: 'https://tiktok.com/@tendai_tech/video/710004',
    screenshotUrl: '/assets/screenshots/clip4.jpg',
    claimedViews: 4820,
    publicViews: 4790,
    verifiedViews: 0,
    averageViews: 4500,
    status: 'submitted',
    flagged: false,
    createdAt: '2026-10-20',
  },
  clip_queue_2: {
    id: 'clip_queue_2',
    campaignId: 'glow_skincare',
    creatorUid: 'rue_uid',
    creatorHandle: '@glow_with_rue',
    platform: 'Instagram',
    link: 'https://instagram.com/p/C9988776',
    screenshotUrl: '/assets/screenshots/clip5.jpg',
    claimedViews: 38000,
    publicViews: 37950,
    verifiedViews: 0,
    averageViews: 2100,
    status: 'submitted',
    flagged: true,
    spikeReason: 'Spike 5×: Claimed 38,000 views vs creator average of 2,100',
    createdAt: '2026-10-20',
  },
  clip_queue_3: {
    id: 'clip_queue_3',
    campaignId: 'bulawayo_fit',
    creatorUid: 'tafara_uid',
    creatorHandle: '@fitwithtafara',
    platform: 'TikTok',
    link: 'https://tiktok.com/@fitwithtafara/video/710006',
    screenshotUrl: '/assets/screenshots/clip6.jpg',
    claimedViews: 1310,
    publicViews: 1305,
    verifiedViews: 0,
    averageViews: 1200,
    status: 'submitted',
    flagged: false,
    createdAt: '2026-10-20',
  },
};

const SEED_LEDGER: Record<string, LedgerDoc> = {
  ledger_1: {
    id: 'ledger_1',
    creatorUid: 'tendai_uid',
    clipId: 'clip_tendai_1',
    amountCents: 820,
    type: 'earned',
    description: 'Glow Skincare · Clip 1 (8,200 verified views)',
    createdAt: '2026-10-16',
  },
  ledger_2: {
    id: 'ledger_2',
    creatorUid: 'tendai_uid',
    clipId: 'clip_tendai_2',
    amountCents: 1450,
    type: 'earned',
    description: 'Bulawayo Fit Week · Clip 2 (14,500 verified views)',
    createdAt: '2026-10-17',
  },
  ledger_3: {
    id: 'ledger_3',
    creatorUid: 'tendai_uid',
    amountCents: 1980,
    type: 'earned',
    description: 'Past campaign earnings',
    createdAt: '2026-10-10',
  },
  ledger_paid_1: {
    id: 'ledger_paid_1',
    creatorUid: 'tendai_uid',
    amountCents: 2800,
    type: 'paid',
    description: 'EcoCash Payout (Ref: EC-88392-ZW)',
    createdAt: '2026-10-12',
  },
};

const SEED_PAYOUTS: Record<string, PayoutDoc> = {
  payout_1: {
    id: 'payout_1',
    creatorUid: 'tendai_uid',
    creatorName: 'Tendai Moyo',
    ecoCashNumber: '+263 77 000 0000',
    amountCents: 2800,
    status: 'paid',
    paidDate: '2026-10-12',
    reference: 'EC-88392-ZW',
    createdAt: '2026-10-11',
  },
};

const SEED_BRAND_VIEWS: Record<string, BrandViewDoc> = {
  'glow-skincare': {
    token: 'glow-skincare',
    campaignId: 'glow_skincare',
    title: 'Glow Skincare Launch',
    brandName: 'Glow Beauty Labs',
    verifiedViews: 112400,
    guaranteedViews: 166667,
    budgetUsedCents: 16860, // $168.60 of $250
    budgetCents: 25000,
    creatorsJoined: 38,
    clipsLive: 74,
    viewsSeries: [
      { label: 'Day 1', value: 12000 },
      { label: 'Day 2', value: 28000 },
      { label: 'Day 3', value: 49000 },
      { label: 'Day 4', value: 68000 },
      { label: 'Day 5', value: 89000 },
      { label: 'Day 6', value: 104000 },
      { label: 'Day 7', value: 112400 },
    ],
    reportSummary: 'Top performing hook: “I swapped my whole routine for 7 days” generated 54% of all verified views with 82% Harare reach.',
  },
};

const SEED_ENQUIRIES: Record<string, EnquiryDoc> = {
  enq_1: {
    id: 'enq_1',
    bizName: 'SolarTech Zim',
    contactName: 'Farai Katsande',
    phone: '+263 77 912 3456',
    niche: 'Tech & gadgets',
    promo: 'Inverter & Lithium battery backup package for load shedding',
    goals: ['Sales or enquiries', 'More people knowing we exist'],
    budget: '$500 to $1,000',
    start: 'This week',
    bestTimes: ['Morning', 'Afternoon'],
    createdAt: '2026-10-19',
    status: 'new',
  },
  enq_2: {
    id: 'enq_2',
    bizName: 'Savanna Organic Honey',
    contactName: 'Chiedza Sibanda',
    phone: '+263 71 884 1122',
    niche: 'Food & travel',
    promo: 'Raw forest honey squeeze bottles in OK & TM Pick n Pay stores',
    goals: ['Launch something new'],
    budget: '$250 to $500',
    start: 'In two weeks',
    bestTimes: ['Afternoon'],
    createdAt: '2026-10-18',
    status: 'booked',
  },
};

// Storage Key
const STORAGE_KEY = 'mhomho_db_state_v1';

export interface DatabaseState {
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
}

function loadState(): DatabaseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read from local storage, using seeds:', e);
  }
  return {
    creatorsPublic: SEED_CREATORS_PUBLIC,
    creatorsPrivate: SEED_CREATORS_PRIVATE,
    campaigns: SEED_CAMPAIGNS,
    campaignFinance: SEED_CAMPAIGN_FINANCE,
    campaignStats: SEED_CAMPAIGN_STATS,
    campaignMembers: SEED_CAMPAIGN_MEMBERS,
    clips: SEED_CLIPS,
    ledger: SEED_LEDGER,
    payouts: SEED_PAYOUTS,
    brandViews: SEED_BRAND_VIEWS,
    enquiries: SEED_ENQUIRIES,
  };
}

function saveState(state: DatabaseState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// Reactive store listeners
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeToDatabase(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let currentState: DatabaseState = loadState();

export function getDatabaseState(): DatabaseState {
  return currentState;
}

export function resetDatabaseToSeeds() {
  currentState = {
    creatorsPublic: SEED_CREATORS_PUBLIC,
    creatorsPrivate: SEED_CREATORS_PRIVATE,
    campaigns: SEED_CAMPAIGNS,
    campaignFinance: SEED_CAMPAIGN_FINANCE,
    campaignStats: SEED_CAMPAIGN_STATS,
    campaignMembers: SEED_CAMPAIGN_MEMBERS,
    clips: SEED_CLIPS,
    ledger: SEED_LEDGER,
    payouts: SEED_PAYOUTS,
    brandViews: SEED_BRAND_VIEWS,
    enquiries: SEED_ENQUIRIES,
  };
  saveState(currentState);
  notify();
}

// ==========================================
// Cloud Functions (Simulated with RBAC & Transactions)
// ==========================================

/**
 * approveCreator (admin-only function)
 * Sets the creator claim and changes status from 'applied' to 'approved'.
 */
export function approveCreator(uid: string, callerRole: UserRole): { success: boolean; error?: string } {
  if (callerRole !== 'admin') {
    return { success: false, error: 'Unauthorized: admin role required.' };
  }
  const creator = currentState.creatorsPublic[uid];
  if (!creator) {
    return { success: false, error: 'Creator not found.' };
  }
  currentState.creatorsPublic[uid] = {
    ...creator,
    status: 'approved',
  };
  saveState(currentState);
  notify();
  return { success: true };
}

/**
 * joinCampaign (creator function)
 * Runs when membership is created. Blocks joining when campaign is full and updates joinedCount.
 */
export function joinCampaign(
  campaignId: string,
  creatorUid: string
): { success: boolean; error?: string } {
  const memberKey = `${campaignId}_${creatorUid}`;
  if (currentState.campaignMembers[memberKey]) {
    return { success: true }; // already joined
  }

  const stats = currentState.campaignStats[campaignId];
  const campaign = currentState.campaigns[campaignId];

  if (!stats || !campaign) {
    return { success: false, error: 'Campaign does not exist.' };
  }

  if (campaign.status === 'full' || campaign.status === 'closed' || !stats.joiningOpen) {
    return { success: false, error: 'This campaign is full or closed to new joins.' };
  }

  // Create membership
  currentState.campaignMembers[memberKey] = {
    id: memberKey,
    campaignId,
    creatorUid,
    joinedAt: new Date().toISOString().split('T')[0],
  };

  // Update stats
  currentState.campaignStats[campaignId] = {
    ...stats,
    joinedCount: stats.joinedCount + 1,
  };

  saveState(currentState);
  notify();
  return { success: true };
}

/**
 * submitClip (creator function)
 * Creator submits a clip URL with claimed views and screenshot path.
 */
export function submitClip(params: {
  campaignId: string;
  creatorUid: string;
  creatorHandle: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  link: string;
  screenshotUrl: string;
  claimedViews: number;
}): { success: boolean; clipId?: string; error?: string } {
  const id = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const creator = currentState.creatorsPublic[params.creatorUid];
  const averageViews = creator ? Math.round(creator.followers * 0.25) : 3000;

  // Spike detection: if claimed views >= 5x creator average
  const isSpike = params.claimedViews >= averageViews * 5;

  const newClip: ClipDoc = {
    id,
    campaignId: params.campaignId,
    creatorUid: params.creatorUid,
    creatorHandle: params.creatorHandle,
    platform: params.platform,
    link: params.link,
    screenshotUrl: params.screenshotUrl,
    claimedViews: params.claimedViews,
    publicViews: params.claimedViews,
    verifiedViews: 0,
    averageViews,
    status: 'submitted',
    flagged: isSpike,
    spikeReason: isSpike ? `Spike 5×: Claimed ${params.claimedViews.toLocaleString()} views vs average ${averageViews.toLocaleString()}` : undefined,
    createdAt: new Date().toISOString().split('T')[0],
  };

  currentState.clips[id] = newClip;
  saveState(currentState);
  notify();
  return { success: true, clipId: id };
}

/**
 * verifyClip (admin-only function, transactional)
 * Inside one Firestore transaction:
 * 1. Read the campaign stats, finance and the clip.
 * 2. Reject if views are under 1,000, the campaign is closed or the pool is used up.
 * 3. Work out the earnings (Section 9).
 * 4. Update the clip status and verified views.
 * 5. Add the earnings to poolUsedCents and the views to verifiedViews.
 * 6. Close joining if the pool used is 80% or more.
 * 7. Write the ledger entry and update brandViews.
 */
export function verifyClipTransaction(
  clipId: string,
  verifiedViews: number,
  callerRole: UserRole
): { success: boolean; earningsCents?: number; error?: string } {
  if (callerRole !== 'admin') {
    return { success: false, error: 'Unauthorized: only admin can verify clips.' };
  }

  const clip = currentState.clips[clipId];
  if (!clip) {
    return { success: false, error: 'Clip not found.' };
  }

  const campaign = currentState.campaigns[clip.campaignId];
  const stats = currentState.campaignStats[clip.campaignId];
  const finance = currentState.campaignFinance[clip.campaignId];

  if (!campaign || !stats || !finance) {
    return { success: false, error: 'Associated campaign data missing.' };
  }

  // 2. Reject conditions
  if (verifiedViews < DEFAULT_MONEY_CONFIG.qualifyingViewThreshold) {
    // Under 1,000 views does not qualify
    currentState.clips[clipId] = {
      ...clip,
      status: 'rejected',
      verifiedViews,
      verifiedAt: new Date().toISOString().split('T')[0],
      earningsCents: 0,
    };
    saveState(currentState);
    notify();
    return { success: false, error: 'Rejected: Verified views under qualifying threshold (1,000 views).' };
  }

  const poolRemaining = stats.poolTotalCents - stats.poolUsedCents;
  if (poolRemaining <= 0) {
    return { success: false, error: 'Cannot verify: Campaign creator pool is completely exhausted.' };
  }

  // 3. Work out earnings
  const earningsResult = calculateClipEarnings(
    verifiedViews,
    stats.poolTotalCents,
    stats.poolUsedCents,
    finance.perPostCapCents
  );

  const earningsCents = earningsResult.earningsCents;

  // 4. Update clip status and verified views
  currentState.clips[clipId] = {
    ...clip,
    status: 'verified',
    verifiedViews,
    verifiedAt: new Date().toISOString().split('T')[0],
    earningsCents,
  };

  // 5. Add earnings to poolUsedCents and views to verifiedViews
  const newPoolUsed = stats.poolUsedCents + earningsCents;
  const newVerifiedViews = stats.verifiedViews + verifiedViews;

  // 6. Close joining if pool used is 80% or more
  const shouldCloseJoining = isJoiningClosed(newPoolUsed, stats.poolTotalCents);

  currentState.campaignStats[clip.campaignId] = {
    ...stats,
    poolUsedCents: newPoolUsed,
    verifiedViews: newVerifiedViews,
    clipsLive: stats.clipsLive + 1,
    joiningOpen: !shouldCloseJoining,
  };

  if (shouldCloseJoining && campaign.status === 'open') {
    currentState.campaigns[clip.campaignId] = {
      ...campaign,
      status: 'full',
    };
  }

  // 7. Write the ledger entry
  const ledgerId = `ledger_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  currentState.ledger[ledgerId] = {
    id: ledgerId,
    creatorUid: clip.creatorUid,
    clipId: clip.id,
    amountCents: earningsCents,
    type: 'earned',
    description: `${campaign.title} · ${clip.platform} (${verifiedViews.toLocaleString()} views)`,
    createdAt: new Date().toISOString().split('T')[0],
  };

  // Update brand views if matching token exists
  Object.keys(currentState.brandViews).forEach((tok) => {
    const bv = currentState.brandViews[tok];
    if (bv.campaignId === clip.campaignId) {
      const newBudgetUsedCents = Math.floor(
        (newVerifiedViews * finance.brandPricePerThousandCents) / 1000
      );
      const updatedSeries = [...bv.viewsSeries];
      updatedSeries.push({
        label: `Day ${updatedSeries.length + 1}`,
        value: newVerifiedViews,
      });

      currentState.brandViews[tok] = {
        ...bv,
        verifiedViews: newVerifiedViews,
        budgetUsedCents: Math.min(bv.budgetCents, newBudgetUsedCents),
        clipsLive: bv.clipsLive + 1,
        viewsSeries: updatedSeries,
      };
    }
  });

  saveState(currentState);
  notify();
  return { success: true, earningsCents };
}

/**
 * rejectClip (admin-only function)
 */
export function rejectClip(clipId: string, callerRole: UserRole, reason?: string): { success: boolean; error?: string } {
  if (callerRole !== 'admin') {
    return { success: false, error: 'Unauthorized.' };
  }
  const clip = currentState.clips[clipId];
  if (!clip) return { success: false, error: 'Clip not found.' };

  currentState.clips[clipId] = {
    ...clip,
    status: 'rejected',
    verifiedViews: 0,
    earningsCents: 0,
    spikeReason: reason || clip.spikeReason,
  };
  saveState(currentState);
  notify();
  return { success: true };
}

/**
 * markPaid (admin-only function)
 * Records a payout and writes to the ledger.
 */
export function markPaid(
  creatorUid: string,
  amountCents: number,
  reference: string,
  callerRole: UserRole
): { success: boolean; error?: string } {
  if (callerRole !== 'admin') {
    return { success: false, error: 'Unauthorized.' };
  }

  const creatorPrivate = currentState.creatorsPrivate[creatorUid];
  const creatorPublic = currentState.creatorsPublic[creatorUid];

  const payoutId = `payout_${Date.now()}`;
  currentState.payouts[payoutId] = {
    id: payoutId,
    creatorUid,
    creatorName: creatorPrivate?.name || creatorPublic?.handle || 'Creator',
    ecoCashNumber: creatorPrivate?.ecoCashNumber || '+263 77 000 0000',
    amountCents,
    status: 'paid',
    paidDate: new Date().toISOString().split('T')[0],
    reference,
    createdAt: new Date().toISOString().split('T')[0],
  };

  // Write ledger payout debit
  const ledgerId = `ledger_paid_${Date.now()}`;
  currentState.ledger[ledgerId] = {
    id: ledgerId,
    creatorUid,
    amountCents,
    type: 'paid',
    description: `EcoCash Payout (Ref: ${reference})`,
    createdAt: new Date().toISOString().split('T')[0],
  };

  saveState(currentState);
  notify();
  return { success: true };
}

/**
 * createEnquiry (public function)
 * Stores website brand quotation and brief.
 */
export function createEnquiry(enquiry: Omit<EnquiryDoc, 'id' | 'createdAt' | 'status'>): string {
  const id = `enq_${Date.now()}`;
  currentState.enquiries[id] = {
    ...enquiry,
    id,
    createdAt: new Date().toISOString().split('T')[0],
    status: 'new',
  };
  saveState(currentState);
  notify();
  return id;
}

/**
 * topUpCampaign (admin-only function)
 * Adds budget, recalculates creator pool and reopens joining if closed.
 */
export function topUpCampaign(
  campaignId: string,
  additionalBudgetCents: number,
  callerRole: UserRole
): { success: boolean; error?: string } {
  if (callerRole !== 'admin') return { success: false, error: 'Unauthorized.' };

  const campaign = currentState.campaigns[campaignId];
  const stats = currentState.campaignStats[campaignId];
  const finance = currentState.campaignFinance[campaignId];

  if (!campaign || !stats || !finance) return { success: false, error: 'Campaign not found.' };

  const newBudgetCents = finance.budgetCents + additionalBudgetCents;
  const newPoolTotalCents = calculateCreatorPool(newBudgetCents);
  const newCapCents = calculatePerPostCap(newPoolTotalCents);

  currentState.campaignFinance[campaignId] = {
    ...finance,
    budgetCents: newBudgetCents,
    perPostCapCents: newCapCents,
  };

  const stillClosed = isJoiningClosed(stats.poolUsedCents, newPoolTotalCents);

  currentState.campaignStats[campaignId] = {
    ...stats,
    poolTotalCents: newPoolTotalCents,
    joiningOpen: !stillClosed,
  };

  currentState.campaigns[campaignId] = {
    ...campaign,
    status: stillClosed ? 'full' : 'open',
  };

  saveState(currentState);
  notify();
  return { success: true };
}

/**
 * Helper to calculate a creator's owed balance and paid balance from ledger
 */
export function calculateCreatorBalances(creatorUid: string) {
  const state = currentState;
  let earnedCents = 0;
  let paidCents = 0;

  Object.values(state.ledger).forEach((entry) => {
    if (entry.creatorUid === creatorUid) {
      if (entry.type === 'earned') {
        earnedCents += entry.amountCents;
      } else if (entry.type === 'paid') {
        paidCents += entry.amountCents;
      }
    }
  });

  const owedCents = Math.max(0, earnedCents - paidCents);

  return {
    earnedCents,
    paidCents,
    owedCents,
  };
}

/**
 * Helper to calculate total owed to all creators (for Admin Dashboard)
 */
export function calculateTotalOwedCents(): number {
  let totalEarned = 0;
  let totalPaid = 0;

  Object.values(currentState.ledger).forEach((entry) => {
    if (entry.type === 'earned') totalEarned += entry.amountCents;
    if (entry.type === 'paid') totalPaid += entry.amountCents;
  });

  return Math.max(0, totalEarned - totalPaid);
}
