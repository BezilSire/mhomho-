import { badRequest } from './http.ts';

export const CAMPAIGN_STATUSES = [
  'draft',
  'scheduled',
  'live',
  'paused',
  'closing',
  'completed',
  'cancelled',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/**
 * Explicit campaign state machine.
 *
 * draft → scheduled → live ⇄ paused → closing → completed
 * any non-terminal state → cancelled
 */
const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['scheduled', 'live', 'cancelled'],
  scheduled: ['live', 'draft', 'cancelled'],
  live: ['paused', 'closing', 'cancelled'],
  paused: ['live', 'closing', 'cancelled'],
  closing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: CampaignStatus, to: CampaignStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw badRequest(`A campaign cannot move from "${from}" to "${to}".`);
  }
}

export function isTerminal(status: CampaignStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

export interface CampaignTiming {
  status: CampaignStatus;
  starts_at: number | null;
  joining_cutoff_at: number | null;
  submission_cutoff_at: number | null;
  views_cutoff_at: number | null;
  ends_at: number | null;
}

export function acceptingParticipants(campaign: CampaignTiming, now = Date.now()): boolean {
  if (campaign.status !== 'live') return false;
  if (campaign.starts_at !== null && now < campaign.starts_at) return false;
  if (campaign.joining_cutoff_at !== null && now >= campaign.joining_cutoff_at) return false;
  return true;
}

export function acceptingSubmissions(campaign: CampaignTiming, now = Date.now()): boolean {
  if (campaign.status !== 'live') return false;
  if (campaign.submission_cutoff_at !== null && now >= campaign.submission_cutoff_at) return false;
  return true;
}

export function acceptingViewVerification(campaign: CampaignTiming, now = Date.now()): boolean {
  if (campaign.status !== 'live' && campaign.status !== 'closing') return false;
  if (campaign.views_cutoff_at !== null && now > campaign.views_cutoff_at) return false;
  return true;
}

/** The campaign is past its view cutoff and may be settled. */
export function settlementReady(campaign: CampaignTiming, now = Date.now()): boolean {
  if (campaign.status !== 'closing') return false;
  if (campaign.views_cutoff_at !== null && now < campaign.views_cutoff_at) return false;
  return true;
}

export interface LifecycleView {
  status: CampaignStatus;
  acceptingJoins: boolean;
  acceptingSubmissions: boolean;
  accumulatingViews: boolean;
  inSettlement: boolean;
  label: string;
  creatorHint: string;
}

export function describeLifecycle(
  campaign: CampaignTiming,
  options: { joiningClosedByBudget: boolean; now?: number }
): LifecycleView {
  const now = options.now ?? Date.now();
  const joins = acceptingParticipants(campaign, now) && !options.joiningClosedByBudget;
  const submissions = acceptingSubmissions(campaign, now);
  const views = acceptingViewVerification(campaign, now);
  const settling = campaign.status === 'closing';

  let label = 'Closed';
  let creatorHint = 'This campaign is closed.';

  switch (campaign.status) {
    case 'draft':
      label = 'Draft';
      creatorHint = 'Not published yet.';
      break;
    case 'scheduled':
      label = 'Scheduled';
      creatorHint = 'Opens soon.';
      break;
    case 'live':
      label = joins ? 'Accepting creators' : 'Submissions only';
      creatorHint = joins
        ? 'Join now, then publish and submit your post.'
        : 'Joining has closed, but approved participants can still submit before the deadline.';
      break;
    case 'paused':
      label = 'Paused';
      creatorHint = 'Paused by operations. Existing submissions are still reviewed.';
      break;
    case 'closing':
      label = 'Settling';
      creatorHint = 'No new posts. Verified views are being finalised before payout.';
      break;
    case 'completed':
      label = 'Completed';
      creatorHint = 'Completed and settled.';
      break;
    case 'cancelled':
      label = 'Cancelled';
      creatorHint = 'This campaign was cancelled.';
      break;
  }

  return {
    status: campaign.status,
    acceptingJoins: joins,
    acceptingSubmissions: submissions,
    accumulatingViews: views,
    inSettlement: settling,
    label,
    creatorHint,
  };
}
