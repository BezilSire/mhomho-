import type {
  AvatarKey,
  ForumCategory,
  ForumThreadStatus,
} from '../../shared/community.ts';
import type { CreatorStatus } from './firebase.ts';

export * from '../../shared/community.ts';

export interface RecentCreator {
  uid: string;
  handle: string;
  avatarKey: AvatarKey;
  platform: string;
  niche: string;
  status: CreatorStatus;
  joinedAtMs: number;
  approvedAtMs: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  handle: string;
  avatarKey: AvatarKey;
  platform: string;
  views: number;
}

export interface ForumThreadSummary {
  id: string;
  authorUid: string;
  authorHandle: string;
  authorAvatarKey: AvatarKey;
  authorPlatform: string;
  category: ForumCategory;
  title: string;
  excerpt: string;
  status: ForumThreadStatus;
  pinned: boolean;
  replyCount: number;
  lastActivityAt: number;
  createdAt: number;
}

export interface ForumThreadDetail extends ForumThreadSummary {
  body: string;
}

export interface ForumReply {
  id: string;
  authorUid: string;
  authorHandle: string;
  authorAvatarKey: AvatarKey;
  authorPlatform: string;
  body: string;
  status: 'active' | 'hidden';
  createdAt: number;
}

export interface CommunityOverview {
  month: { key: string; label: string };
  recentCreators: RecentCreator[];
  leaderboard: LeaderboardEntry[];
  viewerRank: number | null;
  viewerViews: number;
  latestThreads: ForumThreadSummary[];
  totals: { threads: number; replies: number };
}

export interface CommunityThreadList {
  threads: ForumThreadSummary[];
  nextOffset: number;
  category: string;
}

export interface CommunityThreadDetail {
  thread: ForumThreadDetail;
  replies: ForumReply[];
}

export interface AdminCommunityOverview {
  month: { key: string; label: string };
  recentCreators: RecentCreator[];
  leaderboard: LeaderboardEntry[];
  threads: ForumThreadSummary[];
  totals: {
    activeThreads: number;
    lockedThreads: number;
    hiddenThreads: number;
  };
}
