/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Home,
  LayoutDashboard,
  Megaphone,
  Moon,
  Sun,
  User,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import {
  DatabaseState,
  getDatabaseState,
  subscribeToDatabase,
} from './lib/firebase.ts';
import { CreatorHome } from './screens/creator/CreatorHome.tsx';
import { CampaignsFeed } from './screens/creator/CampaignsFeed.tsx';
import { CampaignDetail } from './screens/creator/CampaignDetail.tsx';
import { SubmitClip } from './screens/creator/SubmitClip.tsx';
import { MyClips } from './screens/creator/MyClips.tsx';
import { EarningsScreen } from './screens/creator/EarningsScreen.tsx';
import { CreatorProfile } from './screens/creator/CreatorProfile.tsx';
import { CommunityScreen } from './screens/creator/CommunityScreen.tsx';
import { UnderReviewScreen } from './screens/creator/UnderReviewScreen.tsx';
import { BrandCampaignPage } from './screens/brand/BrandCampaignPage.tsx';
import { AdminVerificationQueue } from './screens/admin/AdminVerificationQueue.tsx';
import { AdminDashboard } from './screens/admin/AdminDashboard.tsx';
import { AdminCampaigns } from './screens/admin/AdminCampaigns.tsx';
import { AdminPayouts } from './screens/admin/AdminPayouts.tsx';
import { AdminEnquiries } from './screens/admin/AdminEnquiries.tsx';
import { AdminBrandWaitlist } from './screens/admin/AdminBrandWaitlist.tsx';
import { AdminBlog } from './screens/admin/AdminBlog.tsx';
import { AdminSecurity } from './screens/admin/AdminSecurity.tsx';
import { AdminAccess } from './screens/admin/AdminAccess.tsx';
import { LandingPage } from './screens/public/LandingPage.tsx';
import { AppEntryScreen } from './screens/public/AppEntryScreen.tsx';
import { CreatorSignupFlow } from './screens/public/LandingSignupFlows.tsx';
import { CreatorGuidePage } from './screens/public/CreatorGuidePage.tsx';
import { LegalPage, type LegalDoc } from './screens/public/LegalPage.tsx';
import { SetupPage } from './screens/public/SetupPage.tsx';
import { LoginModal } from './screens/auth/LoginModal.tsx';
import {
  authenticateCreator,
  bootstrapSession,
  clearAdminLocation,
  isAdminLocation,
  signOut as endSession,
} from './lib/auth.ts';
import { getSession, subscribeToSession, type AuthSession } from './lib/sessionStore.ts';
import { fetchBrandReport } from './lib/api.ts';
import { TabBar, CreatorTabId } from './components/TabBar.tsx';
import { AccountMenu } from './components/AccountMenu.tsx';
import { AdminNav } from './components/AdminNav.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { BrandMark } from './components/BrandMark.tsx';
import { MhomhoLogo } from './components/MhomhoLogo.tsx';
import { ActivityToasts } from './components/ActivityToasts.tsx';
import { NotificationBell } from './components/NotificationBell.tsx';
import { SupportCenter } from './components/SupportCenter.tsx';
import { AdminSupport } from './screens/admin/AdminSupport.tsx';
import { AdminNotifications } from './screens/admin/AdminNotifications.tsx';
import { AdminCommunity } from './screens/admin/AdminCommunity.tsx';
import { AdminInvites } from './screens/admin/AdminInvites.tsx';
import { AdminAmbassadors } from './screens/admin/AdminAmbassadors.tsx';
import { AmbassadorApplyPage } from './screens/public/AmbassadorApplyPage.tsx';
import { AmbassadorPortalPage } from './screens/public/AmbassadorPortalPage.tsx';
import { AmbassadorProfilePage } from './screens/public/AmbassadorProfilePage.tsx';
import { ResourcesPage } from './screens/public/ResourcesPage.tsx';

export type MainViewMode =
  | 'landing'
  | 'creator'
  | 'admin'
  | 'brand'
  | 'legal'
  | 'setup'
  | 'guide'
  | 'resources'
  | 'ambassadorApply'
  | 'ambassadorPortal'
  | 'ambassadorProfile';
export type AdminTabId =
  | 'dashboard'
  | 'ambassadors'
  | 'queue'
  | 'campaigns'
  | 'payouts'
  | 'waitlist'
  | 'enquiries'
  | 'blog'
  | 'community'
  | 'invites'
  | 'support'
  | 'notifications'
  | 'security';

const CREATOR_NAV: { id: CreatorTabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'clips', label: 'Clips', icon: Video },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'profile', label: 'Profile', icon: User },
];

const ADMIN_NAV: { id: AdminTabId; label: string }[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'ambassadors', label: 'Ambassadors' },
  { id: 'queue', label: 'Clip verification' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'waitlist', label: 'Brand waitlist' },
  { id: 'enquiries', label: 'Brand enquiries' },
  { id: 'blog', label: 'Journal' },
  { id: 'community', label: 'Community' },
  { id: 'invites', label: 'Invites' },
  { id: 'support', label: 'Support' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
];

/** The Android TWA and installed-app entry point opens the creator experience. */
function isAppLocation(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'app.mhomho.work' ||
    window.location.pathname.replace(/\/+$/, '') === '/app'
  );
}

/** The launch checklist lives on its own subdomain and at /setup. */
function isSetupLocation(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'setup.mhomho.work' ||
    window.location.pathname.replace(/\/+$/, '') === '/setup'
  );
}

/** The creator guide is a public page on the main site only. */
function isGuideLocation(): boolean {
  if (typeof window === 'undefined' || isAppLocation()) return false;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  return path === '/creator-guide' || path === '/guide';
}

/** The resources page is a public page on the main site only. */
function isResourcesLocation(): boolean {
  if (typeof window === 'undefined' || isAppLocation()) return false;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  return path === '/resources';
}

type AmbassadorLocation =
  | { kind: 'apply' }
  | { kind: 'portal' }
  | { kind: 'profile'; username: string };

/** Public ambassador routes live on the main site, never on the app host. */
function ambassadorLocationFromLocation(): AmbassadorLocation | null {
  if (typeof window === 'undefined' || isAppLocation()) return null;
  const path = window.location.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const root = parts[0].toLowerCase();
  if (root !== 'ambassadors' && root !== 'envoys') return null;
  const leaf = parts[1] ?? '';
  if (!leaf) return { kind: 'apply' };
  if (leaf.toLowerCase() === 'apply') return { kind: 'apply' };
  if (leaf.toLowerCase() === 'portal' || leaf.toLowerCase() === 'login') {
    return { kind: 'portal' };
  }
  if (parts.length > 2) return null;
  return { kind: 'profile', username: decodeURIComponent(leaf) };
}

function clearAmbassadorLocation(): void {
  if (typeof window === 'undefined' || !ambassadorLocationFromLocation()) return;
  window.history.replaceState(null, '', '/');
}

/** Brand report links arrive as ?report=<token> or #brand/<token>. */
function brandTokenFromLocation(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('report');
  if (fromQuery) return fromQuery;
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash.startsWith('brand/') ? hash.slice('brand/'.length) : '';
}

/** Legal pages are public, shareable hash routes so they work on static hosting. */
function legalDocFromLocation(): LegalDoc | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase();
  if (hash === 'terms' || hash === 'terms-of-service') return 'terms';
  if (hash === 'privacy' || hash === 'privacy-policy') return 'privacy';
  return null;
}

function clearLegalLocation(): void {
  if (typeof window === 'undefined' || !legalDocFromLocation()) return;
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  );
}

function clearAppLocation(): void {
  if (typeof window === 'undefined' || !isAppLocation()) return;
  window.history.replaceState(null, '', `/${window.location.search}`);
}

function clearGuideLocation(): void {
  if (typeof window === 'undefined' || !isGuideLocation()) return;
  window.history.replaceState(null, '', `/${window.location.search}`);
}

export default function App() {
  const [db, setDb] = useState<DatabaseState>(getDatabaseState());
  const [session, setSession] = useState<AuthSession | null>(() => getSession());
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(() => legalDocFromLocation());
  const [viewMode, setViewMode] = useState<MainViewMode>(() => {
    if (isSetupLocation()) return 'setup';
    if (isAdminLocation()) return 'admin';
    if (isGuideLocation()) return 'guide';
    if (isResourcesLocation()) return 'resources';
    const ambassador = ambassadorLocationFromLocation();
    if (ambassador?.kind === 'apply') return 'ambassadorApply';
    if (ambassador?.kind === 'portal') return 'ambassadorPortal';
    if (ambassador?.kind === 'profile') return 'ambassadorProfile';
    if (legalDocFromLocation()) return 'legal';
    if (brandTokenFromLocation()) return 'brand';
    if (isAppLocation() && getSession()?.role === 'creator') return 'creator';
    return 'landing';
  });
  const [ambassadorUsername, setAmbassadorUsername] = useState<string>(() => {
    const ambassador = ambassadorLocationFromLocation();
    return ambassador?.kind === 'profile' ? ambassador.username : '';
  });

  // Creator portal navigation state
  const [creatorTab, setCreatorTab] = useState<CreatorTabId>('home');
  const [activeCampaignDetailId, setActiveCampaignDetailId] = useState<string | null>(null);
  const [isSubmittingClip, setIsSubmittingClip] = useState<boolean>(false);
  const [submitClipCampaignId, setSubmitClipCampaignId] = useState<string | undefined>(undefined);

  // Admin portal navigation state
  const [adminTab, setAdminTab] = useState<AdminTabId>('dashboard');

  // Brand report state
  const [brandToken] = useState<string>(() => brandTokenFromLocation());

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals and app-only navigation
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showCreatorSignup, setShowCreatorSignup] = useState<boolean>(false);
  const [showSupport, setShowSupport] = useState<boolean>(false);
  const authOverlayOpen = showLoginModal || showCreatorSignup;

  useEffect(() => {
    const unsubscribe = subscribeToDatabase(() => {
      setDb({ ...getDatabaseState() });
    });
    return unsubscribe;
  }, []);

  useEffect(() => subscribeToSession(() => setSession(getSession())), []);

  // Sign-in and sign-up are in-app screens. Keep one history entry while either
  // is open so Android back returns to the app entry screen, and switching
  // between the two never bounces the creator out of the app.
  useEffect(() => {
    if (!authOverlayOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.history.pushState({ ...(window.history.state || {}), mhomhoAuth: true }, '');

    const onPopState = () => {
      if (!window.history.state?.mhomhoAuth) {
        setShowLoginModal(false);
        setShowCreatorSignup(false);
      }
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('popstate', onPopState);
      if (window.history.state?.mhomhoAuth) window.history.back();
    };
  }, [authOverlayOpen]);

  // Load the session and the anonymous projection once at boot. The UI stays
  // behind a splash until the server answers, so no portal can flash open on a
  // stale client-side guess.
  useEffect(() => {
    let cancelled = false;
    bootstrapSession()
      .then((next) => {
        if (cancelled) return;
        setSession(next);
        if (next?.role === 'creator') {
          setShowLoginModal(false);
          setShowCreatorSignup(false);
          setViewMode((current) => (current === 'landing' ? 'creator' : current));
        }
      })
      .catch(() => {
        if (!cancelled) setBootError('We could not reach the server. Check your connection and reload.');
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Brand reports are fetched with an unguessable token, never from local data.
  useEffect(() => {
    if (viewMode !== 'brand' || !brandToken) return;
    void fetchBrandReport(brandToken);
  }, [viewMode, brandToken]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Keep Android's status bar and the browser toolbar in sync with the app.
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', theme === 'dark' ? '#080706' : '#F4F1EC');
    }
  }, [theme]);

  // The admin console shell is served only at the server-gated
  // /console/<ADMIN_PATH> path. There are no public links to it, and
  // credentials are still required even if the URL is discovered.
  useEffect(() => {
    const syncLocation = () => {
      if (isSetupLocation()) {
        setShowLoginModal(false);
        setLegalDoc(null);
        setViewMode('setup');
        return;
      }

      if (isAdminLocation()) {
        setShowLoginModal(false);
        setLegalDoc(null);
        setViewMode('admin');
        return;
      }

      if (isGuideLocation()) {
        setShowLoginModal(false);
        setShowCreatorSignup(false);
        setLegalDoc(null);
        setViewMode('guide');
        return;
      }

      if (isResourcesLocation()) {
        setShowLoginModal(false);
        setShowCreatorSignup(false);
        setLegalDoc(null);
        setViewMode('resources');
        return;
      }

      const ambassador = ambassadorLocationFromLocation();
      if (ambassador) {
        setShowLoginModal(false);
        setShowCreatorSignup(false);
        setLegalDoc(null);
        setAmbassadorUsername(ambassador.kind === 'profile' ? ambassador.username : '');
        setViewMode(
          ambassador.kind === 'apply'
            ? 'ambassadorApply'
            : ambassador.kind === 'portal'
              ? 'ambassadorPortal'
              : 'ambassadorProfile'
        );
        return;
      }

      const nextLegalDoc = legalDocFromLocation();
      if (nextLegalDoc) {
        setShowLoginModal(false);
        setLegalDoc(nextLegalDoc);
        setViewMode('legal');
        return;
      }

      setLegalDoc(null);
      setAmbassadorUsername('');
      setViewMode((current) =>
        current === 'admin' ||
        current === 'legal' ||
        current === 'setup' ||
        current === 'guide' ||
        current === 'resources' ||
        current === 'ambassadorApply' ||
        current === 'ambassadorPortal' ||
        current === 'ambassadorProfile'
          ? 'landing'
          : current
      );
    };
    syncLocation();
    window.addEventListener('popstate', syncLocation);
    window.addEventListener('hashchange', syncLocation);
    return () => {
      window.removeEventListener('popstate', syncLocation);
      window.removeEventListener('hashchange', syncLocation);
    };
  }, []);

  // Sessions are short-lived and expire in the background. The server enforces
  // the same expiry independently; this only keeps the UI honest.
  useEffect(() => {
    if (!session) return;

    const expire = () => {
      void endSession();
      if (session.role === 'admin') clearAdminLocation();
      setSession(null);
      setViewMode((current) => (current === 'legal' ? current : 'landing'));
    };

    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, remaining);
    return () => window.clearTimeout(timer);
  }, [session]);

  // Always enter a portal or legal page at the top.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [viewMode, legalDoc]);

  useEffect(() => {
    document.title =
      viewMode === 'setup'
        ? 'Setup — Mhomho Media'
        : viewMode === 'guide'
        ? 'Creator Guide — Mhomho Media'
        : viewMode === 'resources'
        ? 'Commercial Envoy programme — Mhomho Media'
        : viewMode === 'ambassadorApply'
        ? 'Become an MHOMHO Ambassador — Mhomho Media'
        : viewMode === 'ambassadorPortal'
        ? 'Ambassador portal — Mhomho Media'
        : viewMode === 'ambassadorProfile'
        ? 'MHOMHO Ambassador — Mhomho Media'
        : viewMode === 'legal' && legalDoc
        ? `${legalDoc === 'terms' ? 'Terms of Service' : 'Privacy Policy'} — Mhomho Media`
        : isAppLocation()
        ? 'Mhomho — Creator app'
        : 'Mhomho Media — Activate your crowd. Get paid to post.';
  }, [viewMode, legalDoc]);

  const currentCreatorUid = session?.role === 'creator' ? session.uid : '';
  const currentCreator = currentCreatorUid ? db.creatorsPublic[currentCreatorUid] : undefined;
  const isRejected = currentCreator?.status === 'rejected';
  const adminAuthed = session?.role === 'admin';
  const inApp = isAppLocation();

  // The mobile app bar shows the current screen, the way a native app does.
  const creatorSectionLabel = isSubmittingClip
    ? 'Submit clip'
    : activeCampaignDetailId
    ? 'Campaign brief'
    : CREATOR_NAV.find((item) => item.id === creatorTab)?.label ?? 'Creator';

  const queuePendingCount = Object.values(db.clips).filter((c) => c.status === 'submitted').length;
  const enquiriesCount = Object.values(db.enquiries).filter((e) => e.status === 'new').length;
  const waitlistCount = Object.values(db.brandWaitlist).filter((e) => e.status === 'new').length;
  const applicantsCount = Object.values(db.creatorsPublic).filter((c) => c.status === 'applied').length;

  const goPublic = () => {
    // The app subdomain and /app are app-only. Nothing inside the installed
    // app may bounce the creator out to the marketing site.
    if (isAppLocation()) {
      clearLegalLocation();
      setLegalDoc(null);
      setViewMode(session?.role === 'creator' ? 'creator' : 'landing');
      setActiveCampaignDetailId(null);
      setIsSubmittingClip(false);
      setShowLoginModal(false);
      setShowCreatorSignup(false);
      return;
    }
    clearAdminLocation();
    clearLegalLocation();
    clearGuideLocation();
    clearAppLocation();
    clearAmbassadorLocation();
    setLegalDoc(null);
    setViewMode('landing');
    setActiveCampaignDetailId(null);
    setIsSubmittingClip(false);
    setShowLoginModal(false);
    setShowCreatorSignup(false);
  };

  const signOut = () => {
    const inApp = isAppLocation();
    void endSession();
    if (inApp) {
      clearLegalLocation();
    } else {
      clearAdminLocation();
      clearLegalLocation();
      clearGuideLocation();
      clearAppLocation();
      clearAmbassadorLocation();
    }
    setLegalDoc(null);
    setSession(null);
    setViewMode('landing');
    setCreatorTab('home');
    setActiveCampaignDetailId(null);
    setIsSubmittingClip(false);
    setShowLoginModal(false);
    setShowCreatorSignup(false);
  };

  const openCreator = () => {
    clearGuideLocation();
    setViewMode('creator');
    setCreatorTab('home');
    setActiveCampaignDetailId(null);
    setIsSubmittingClip(false);
  };

  const openGuide = () => {
    if (isAppLocation()) return;
    clearAdminLocation();
    clearLegalLocation();
    setLegalDoc(null);
    setShowLoginModal(false);
    setShowCreatorSignup(false);
    setViewMode('guide');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/creator-guide');
    }
  };

  const openAmbassadorApply = () => {
    if (isAppLocation()) return;
    clearAdminLocation();
    clearLegalLocation();
    clearGuideLocation();
    clearAppLocation();
    setLegalDoc(null);
    setShowLoginModal(false);
    setShowCreatorSignup(false);
    setAmbassadorUsername('');
    setViewMode('ambassadorApply');
    window.history.pushState(null, '', '/ambassadors/apply');
  };

  const openAmbassadorPortal = () => {
    if (isAppLocation()) return;
    clearAdminLocation();
    clearLegalLocation();
    clearGuideLocation();
    clearAppLocation();
    setLegalDoc(null);
    setShowLoginModal(false);
    setShowCreatorSignup(false);
    setAmbassadorUsername('');
    setViewMode('ambassadorPortal');
    window.history.pushState(null, '', '/ambassadors/portal');
  };

  const handleCreatorApplySuccess = (_newUid: string) => {
    const next = getSession();
    if (next?.role === 'creator') setSession(next);
    setShowCreatorSignup(false);
    setShowLoginModal(false);
    openCreator();
  };

  const handleCreatorLogin = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await authenticateCreator(identifier, password);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const next = getSession();
    if (!next) return { success: false, error: 'The server did not create a session.' };
    setSession(next);
    setShowLoginModal(false);
    setShowCreatorSignup(false);
    openCreator();
    return { success: true };
  };

  const handleAdminAuthenticated = (_email: string) => {
    const next = getSession();
    if (next?.role === 'admin') setSession(next);
    setViewMode('admin');
    setAdminTab('dashboard');
  };

  // A stale creator session must never expose portal content.
  useEffect(() => {
    if (session?.role === 'creator' && !db.creatorsPublic[session.uid]) {
      signOut();
    }
  }, [session, db.creatorsPublic]);

  if (viewMode === 'setup') {
    return <SetupPage />;
  }

  if (booting && viewMode !== 'legal' && viewMode !== 'guide') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--page)] px-6 text-center font-montserrat text-[var(--text)]">
        <BrandMark size={44} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--faint)]">
          Loading Mhomho
        </p>
        <p className="max-w-xs text-[12.5px] leading-relaxed text-[var(--muted)]">
          Checking your session and loading live campaigns.
        </p>
      </div>
    );
  }

  if (bootError && viewMode !== 'legal' && viewMode !== 'guide') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--page)] px-6 text-center font-montserrat text-[var(--text)]">
        <BrandMark size={44} />
        <h1 className="font-display text-[22px] font-bold">The site could not load</h1>
        <p className="max-w-sm text-[13px] leading-relaxed text-[var(--muted)]">{bootError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex h-11 items-center rounded-full bg-gradient-mhomho px-6 text-[13px] font-bold text-[var(--ink)] cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  // Admin access is never rendered without an authenticated admin session,
  // even if someone finds the private location.
  if (viewMode === 'admin' && !adminAuthed) {
    return (
      <AdminAccess onAuthenticated={handleAdminAuthenticated} onCancel={goPublic} />
    );
  }

  // A creator may not see or interact with any portal surface until approval.
  if (viewMode === 'creator' && currentCreator?.status === 'applied') {
    return (
      <>
        <UnderReviewScreen
          db={db}
          currentUid={currentCreatorUid}
          onLogout={signOut}
          onOpenSupport={() => setShowSupport(true)}
        />
        <SupportCenter isOpen={showSupport} onClose={() => setShowSupport(false)} />
      </>
    );
  }

  if (viewMode === 'creator' && !currentCreator) {
    return null;
  }

  const portalLabel =
    viewMode === 'creator'
      ? 'Creator portal'
      : viewMode === 'admin'
      ? 'Operations'
      : 'Campaign report';

  const portalContext =
    viewMode === 'creator'
      ? currentCreator?.handle || 'Creator'
      : viewMode === 'admin'
      ? 'Mhomho operations'
      : 'Shared with the brand';

  return (
    <div
      className={`flex flex-col overflow-x-clip bg-[var(--page)] font-montserrat text-[var(--text)] ${
        viewMode === 'creator' ? 'h-[100dvh] overflow-hidden overscroll-none' : 'min-h-[100dvh]'
      }`}
    >
      <OfflineIndicator />
      <ActivityToasts
        enabled={viewMode === 'creator' || viewMode === 'admin'}
        showHandles={db.viewer?.role === 'creator' || db.viewer?.role === 'admin'}
      />

      {/* ======================================================== */}
      {/* 1. PUBLIC SITE                                           */}
      {/* ======================================================== */}
      {viewMode === 'guide' ? (
        <CreatorGuidePage
          onBack={goPublic}
          onApply={() => setShowCreatorSignup(true)}
          onOpenSignIn={() => setShowLoginModal(true)}
        />
      ) : viewMode === 'resources' ? (
        <ResourcesPage onBack={goPublic} onApply={openAmbassadorApply} />
      ) : viewMode === 'legal' && legalDoc ? (
        <LegalPage doc={legalDoc} onBack={goPublic} />
      ) : viewMode === 'ambassadorApply' ? (
        <AmbassadorApplyPage onBack={goPublic} onOpenPortal={openAmbassadorPortal} />
      ) : viewMode === 'ambassadorPortal' ? (
        <AmbassadorPortalPage onBack={goPublic} onApply={openAmbassadorApply} />
      ) : viewMode === 'ambassadorProfile' ? (
        <AmbassadorProfilePage
          username={ambassadorUsername}
          onBack={goPublic}
          onApply={openAmbassadorApply}
        />
      ) : viewMode === 'landing' ? (
        inApp ? (
          <AppEntryScreen
            onSignIn={() => setShowLoginModal(true)}
            onApply={() => setShowCreatorSignup(true)}
          />
        ) : (
          <LandingPage
            db={db}
            onCreatorApplySuccess={handleCreatorApplySuccess}
            onOpenSignIn={() => setShowLoginModal(true)}
            onOpenGuide={openGuide}
          />
        )
      ) : (
        /* ======================================================== */
        /* 2. AUTHENTICATED PORTAL                                  */
        /* ======================================================== */
        <>
          <header className="safe-top sticky top-0 z-40 shrink-0 border-b border-[var(--line)] bg-[var(--page)]/90 backdrop-blur-xl">
            <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-8">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                {inApp ? (
                  <span className="flex shrink-0 items-center gap-2.5">
                    <MhomhoLogo className="h-6 w-auto sm:h-8" />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={goPublic}
                    className="press flex shrink-0 items-center gap-2.5 text-inherit cursor-pointer"
                    title="Back to the public site"
                  >
                    <MhomhoLogo className="h-6 w-auto sm:h-8" />
                  </button>
                )}

                <span className="hidden h-5 w-px bg-[var(--line)] sm:block" />

                <div className="min-w-0">
                  <p className="hidden text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)] sm:block">
                    {portalLabel}
                  </p>
                  <p className="truncate text-[13px] font-semibold text-[var(--text)] sm:text-[12.5px]">
                    {viewMode === 'creator' ? creatorSectionLabel : portalContext}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                {viewMode === 'creator' && <NotificationBell />}

                {(viewMode === 'creator' || viewMode === 'admin') && (
                  <AccountMenu
                    label={
                      viewMode === 'creator'
                        ? currentCreator?.handle || 'Creator'
                        : session?.identifier || 'Operations'
                    }
                    sublabel={viewMode === 'creator' ? 'Creator account' : 'Mhomho operations'}
                    handle={
                      viewMode === 'creator' ? currentCreator?.handle : 'Operations'
                    }
                    avatarKey={viewMode === 'creator' ? currentCreator?.avatarKey : undefined}
                    isAdmin={viewMode === 'admin'}
                    active={viewMode === 'creator' && creatorTab === 'profile'}
                    onProfile={
                      viewMode === 'creator'
                        ? () => {
                            setActiveCampaignDetailId(null);
                            setIsSubmittingClip(false);
                            setCreatorTab('profile');
                          }
                        : undefined
                    }
                    onSupport={viewMode === 'creator' ? () => setShowSupport(true) : undefined}
                    onPublic={goPublic}
                    showPublicSite={!inApp}
                    onSignOut={signOut}
                    theme={theme}
                    onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  />
                )}

                {viewMode === 'brand' && (
                  <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    aria-label="Toggle theme"
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* ======================================================== */}
          {/* A. CREATOR PORTAL                                        */}
          {/* ======================================================== */}
          {viewMode === 'creator' && (
            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-0 sm:px-6 sm:py-7">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-[var(--line)] bg-[var(--bg)] sm:rounded-[22px] sm:border sm:shadow-[var(--shadow-soft)]">
                {isRejected ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--err)]">
                      <User size={22} />
                    </span>
                    <h2 className="font-display mt-5 text-[24px] font-bold">Application not approved</h2>
                    <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--muted)]">
                      We couldn’t verify this profile for the roster. Email support@mhomho.work if
                      you think this was a mistake.
                    </p>
                    <button
                      type="button"
                      onClick={signOut}
                      className="mt-6 inline-flex h-11 items-center rounded-full bg-gradient-mhomho px-6 text-[13px] font-bold text-[var(--ink)] cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Desktop navigation */}
                    <div className="hidden items-center gap-1 border-b border-[var(--line)] px-3 py-2 sm:flex">
                      {CREATOR_NAV.map((item) => {
                        const isActive =
                          creatorTab === item.id && !isSubmittingClip && !activeCampaignDetailId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveCampaignDetailId(null);
                              setIsSubmittingClip(false);
                              setCreatorTab(item.id);
                            }}
                            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-[var(--surface-2)] text-[var(--text)]'
                                : 'text-[var(--muted)] hover:text-[var(--text)]'
                            }`}
                          >
                            <item.icon size={15} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      {isSubmittingClip ? (
                        <SubmitClip
                          initialCampaignId={submitClipCampaignId}
                          db={db}
                          currentUid={currentCreatorUid}
                          onBack={() => setIsSubmittingClip(false)}
                          onSuccess={() => {
                            setIsSubmittingClip(false);
                            setCreatorTab('clips');
                          }}
                        />
                      ) : activeCampaignDetailId ? (
                        <CampaignDetail
                          campaignId={activeCampaignDetailId}
                          db={db}
                          currentUid={currentCreatorUid}
                          onBack={() => setActiveCampaignDetailId(null)}
                          onSubmitClip={(campId) => {
                            setSubmitClipCampaignId(campId);
                            setIsSubmittingClip(true);
                            setActiveCampaignDetailId(null);
                          }}
                        />
                      ) : (
                        <>
                          {creatorTab === 'home' && (
                            <CreatorHome
                              db={db}
                              currentUid={currentCreatorUid}
                              onNavigateToCampaign={(campId) => setActiveCampaignDetailId(campId)}
                              onNavigateToTab={(tab) => setCreatorTab(tab)}
                              onSubmitClip={() => {
                                setSubmitClipCampaignId(undefined);
                                setIsSubmittingClip(true);
                              }}
                            />
                          )}

                          {creatorTab === 'campaigns' && (
                            <CampaignsFeed
                              db={db}
                              currentUid={currentCreatorUid}
                              onSelectCampaign={(campId) => setActiveCampaignDetailId(campId)}
                            />
                          )}

                          {creatorTab === 'clips' && (
                            <MyClips
                              db={db}
                              currentUid={currentCreatorUid}
                              onSubmitNew={() => {
                                setSubmitClipCampaignId(undefined);
                                setIsSubmittingClip(true);
                              }}
                            />
                          )}

                          {creatorTab === 'community' && (
                            <CommunityScreen currentUid={currentCreatorUid} />
                          )}

                          {creatorTab === 'earnings' && (
                            <EarningsScreen
                              db={db}
                              currentUid={currentCreatorUid}
                              onEditEcoCash={() => setCreatorTab('profile')}
                            />
                          )}

                          {creatorTab === 'profile' && (
                            <CreatorProfile
                              db={db}
                              currentUid={currentCreatorUid}
                              onLogout={signOut}
                              onOpenSupport={() => setShowSupport(true)}
                            />
                          )}
                        </>
                      )}
                    </div>

                    <TabBar
                      activeTab={creatorTab}
                      onTabChange={(tab) => {
                        setActiveCampaignDetailId(null);
                        setIsSubmittingClip(false);
                        setCreatorTab(tab);
                      }}
                      className="sm:hidden"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* B. ADMIN CONSOLE                                         */}
          {/* ======================================================== */}
          {viewMode === 'admin' && (
            <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-5 py-6 sm:px-8 sm:py-8">
              <div className="mb-6 flex flex-col gap-4 border-b border-[var(--line)] pb-5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--a1)]">
                    <LayoutDashboard size={16} />
                  </span>
                  <div>
                    <h1 className="font-display text-[20px] font-bold leading-tight">Operations</h1>
                    <p className="text-[12px] text-[var(--muted)]">
                      Applications, clips, campaigns and payouts
                    </p>
                  </div>
                </div>

                <AdminNav
                  tabs={ADMIN_NAV}
                  activeTab={adminTab}
                  counts={{
                    queue: queuePendingCount,
                    enquiries: enquiriesCount,
                    waitlist: waitlistCount,
                    dashboard: applicantsCount,
                  }}
                  onChange={(id) => setAdminTab(id as AdminTabId)}
                />
              </div>

              <div className="flex-1">
                {adminTab === 'dashboard' && <AdminDashboard db={db} />}
                {adminTab === 'ambassadors' && <AdminAmbassadors />}
                {adminTab === 'queue' && <AdminVerificationQueue db={db} />}
                {adminTab === 'campaigns' && <AdminCampaigns db={db} />}
                {adminTab === 'payouts' && <AdminPayouts db={db} />}
                {adminTab === 'waitlist' && <AdminBrandWaitlist db={db} />}
                {adminTab === 'enquiries' && <AdminEnquiries db={db} />}
                {adminTab === 'blog' && <AdminBlog />}
                {adminTab === 'community' && <AdminCommunity />}
                {adminTab === 'invites' && <AdminInvites />}
                {adminTab === 'support' && <AdminSupport />}
                {adminTab === 'notifications' && <AdminNotifications db={db} />}
                {adminTab === 'security' && <AdminSecurity email={session?.identifier} />}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* C. BRAND CAMPAIGN REPORT                                 */}
          {/* ======================================================== */}
          {viewMode === 'brand' && (
            <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
              <div className="flex flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--bg)] shadow-[var(--shadow-soft)]">
                <BrandCampaignPage token={brandToken} db={db} onSelectToken={() => {}} />
              </div>
            </div>
          )}
        </>
      )}

      <SupportCenter isOpen={showSupport} onClose={() => setShowSupport(false)} />

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleCreatorLogin}
        onApply={() => {
          setShowLoginModal(false);
          setShowCreatorSignup(true);
        }}
      />

      {showCreatorSignup && (
        <CreatorSignupFlow
          manageHistory={false}
          onClose={() => setShowCreatorSignup(false)}
          onCreatorApplySuccess={(newUid) => {
            setShowCreatorSignup(false);
            handleCreatorApplySuccess(newUid);
          }}
          onOpenSignIn={() => {
            setShowCreatorSignup(false);
            setShowLoginModal(true);
          }}
        />
      )}
    </div>
  );
}
