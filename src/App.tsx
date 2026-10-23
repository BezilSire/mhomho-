/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Home,
  LayoutDashboard,
  Megaphone,
  Moon,
  Sun,
  User,
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
import { UnderReviewScreen } from './screens/creator/UnderReviewScreen.tsx';
import { BrandCampaignPage } from './screens/brand/BrandCampaignPage.tsx';
import { AdminVerificationQueue } from './screens/admin/AdminVerificationQueue.tsx';
import { AdminDashboard } from './screens/admin/AdminDashboard.tsx';
import { AdminCampaigns } from './screens/admin/AdminCampaigns.tsx';
import { AdminPayouts } from './screens/admin/AdminPayouts.tsx';
import { AdminEnquiries } from './screens/admin/AdminEnquiries.tsx';
import { AdminAccess } from './screens/admin/AdminAccess.tsx';
import { LandingPage } from './screens/public/LandingPage.tsx';
import { LoginModal } from './screens/auth/LoginModal.tsx';
import {
  AuthSession,
  authenticateCreator,
  clearAdminLocation,
  clearSession,
  createSession,
  getSession,
  isAdminLocation,
  saveSession,
} from './lib/auth.ts';
import { TabBar, CreatorTabId } from './components/TabBar.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { BrandMark } from './components/BrandMark.tsx';

export type MainViewMode = 'landing' | 'creator' | 'admin' | 'brand';
export type AdminTabId = 'dashboard' | 'queue' | 'campaigns' | 'payouts' | 'enquiries';

const CREATOR_NAV: { id: CreatorTabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'clips', label: 'Clips', icon: Video },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'profile', label: 'Profile', icon: User },
];

const ADMIN_NAV: { id: AdminTabId; label: string }[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'queue', label: 'Clip verification' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'enquiries', label: 'Brand enquiries' },
];

export default function App() {
  const [db, setDb] = useState<DatabaseState>(getDatabaseState());
  const [session, setSession] = useState<AuthSession | null>(() => getSession());
  const [viewMode, setViewMode] = useState<MainViewMode>(() => {
    if (isAdminLocation()) return 'admin';
    return getSession()?.role === 'creator' ? 'creator' : 'landing';
  });

  // Creator portal navigation state
  const [creatorTab, setCreatorTab] = useState<CreatorTabId>('home');
  const [activeCampaignDetailId, setActiveCampaignDetailId] = useState<string | null>(null);
  const [isSubmittingClip, setIsSubmittingClip] = useState<boolean>(false);
  const [submitClipCampaignId, setSubmitClipCampaignId] = useState<string | undefined>(undefined);

  // Admin portal navigation state
  const [adminTab, setAdminTab] = useState<AdminTabId>('dashboard');

  // Brand report state
  const [brandToken] = useState<string>('glow-skincare');

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeToDatabase(() => {
      setDb({ ...getDatabaseState() });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // The admin console only exists at the private hash location. There are no
  // public links to it, and credentials are still required even when found.
  useEffect(() => {
    const syncLocation = () => {
      if (isAdminLocation()) {
        setShowLoginModal(false);
        setViewMode('admin');
      } else {
        setViewMode((current) => (current === 'admin' ? 'landing' : current));
      }
    };
    syncLocation();
    window.addEventListener('hashchange', syncLocation);
    return () => window.removeEventListener('hashchange', syncLocation);
  }, []);

  // Sessions are short-lived and expire in the background.
  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      clearSession();
      if (session.role === 'admin') clearAdminLocation();
      setSession(null);
      setViewMode('landing');
      return;
    }
    const timer = window.setTimeout(() => {
      clearSession();
      if (session.role === 'admin') clearAdminLocation();
      setSession(null);
      setViewMode('landing');
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [session]);

  // Always enter a portal at the top of the page.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [viewMode]);

  const currentCreatorUid = session?.role === 'creator' ? session.uid : '';
  const currentCreator = currentCreatorUid ? db.creatorsPublic[currentCreatorUid] : undefined;
  const isRejected = currentCreator?.status === 'rejected';
  const adminAuthed = session?.role === 'admin';

  const queuePendingCount = Object.values(db.clips).filter((c) => c.status === 'submitted').length;
  const enquiriesCount = Object.values(db.enquiries).filter((e) => e.status === 'new').length;
  const applicantsCount = Object.values(db.creatorsPublic).filter((c) => c.status === 'applied').length;

  const goPublic = () => {
    clearAdminLocation();
    setViewMode('landing');
    setActiveCampaignDetailId(null);
    setIsSubmittingClip(false);
    setShowLoginModal(false);
  };

  const signOut = () => {
    clearSession();
    clearAdminLocation();
    setSession(null);
    setViewMode('landing');
    setCreatorTab('home');
    setActiveCampaignDetailId(null);
    setIsSubmittingClip(false);
    setShowLoginModal(false);
  };

  const openCreator = () => {
    setViewMode('creator');
    setCreatorTab('home');
    setActiveCampaignDetailId(null);
    setIsSubmittingClip(false);
  };

  const handleCreatorApplySuccess = (newUid: string) => {
    const nextSession = createSession('creator', newUid, newUid);
    saveSession(nextSession);
    setSession(nextSession);
    openCreator();
  };

  const handleCreatorLogin = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await authenticateCreator(identifier, password);
    if (!result.success || !result.uid) {
      return { success: false, error: result.error };
    }
    const nextSession = createSession('creator', result.uid, identifier.trim());
    saveSession(nextSession);
    setSession(nextSession);
    openCreator();
    return { success: true };
  };

  const handleAdminAuthenticated = (email: string) => {
    const nextSession = createSession('admin', 'admin_uid', email);
    saveSession(nextSession);
    setSession(nextSession);
    setViewMode('admin');
    setAdminTab('dashboard');
  };

  // A stale creator session must never expose portal content.
  useEffect(() => {
    if (session?.role === 'creator' && !db.creatorsPublic[session.uid]) {
      signOut();
    }
  }, [session, db.creatorsPublic]);

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
      <UnderReviewScreen
        db={db}
        currentUid={currentCreatorUid}
        onLogout={signOut}
      />
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
    <div className="flex min-h-screen flex-col bg-[var(--page)] font-montserrat text-[var(--text)]">
      <OfflineIndicator />

      {/* ======================================================== */}
      {/* 1. PUBLIC SITE                                           */}
      {/* ======================================================== */}
      {viewMode === 'landing' ? (
        <LandingPage
          db={db}
          onCreatorApplySuccess={handleCreatorApplySuccess}
          onOpenSignIn={() => setShowLoginModal(true)}
        />
      ) : (
        /* ======================================================== */
        /* 2. AUTHENTICATED PORTAL                                  */
        /* ======================================================== */
        <>
          <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/85 backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={goPublic}
                  className="flex shrink-0 items-center gap-2.5 text-inherit cursor-pointer"
                  title="Back to the public site"
                >
                  <BrandMark size={30} />
                  <span className="font-display hidden text-[13px] font-extrabold tracking-[0.18em] sm:block">
                    MHOMHO
                  </span>
                </button>

                <span className="hidden h-5 w-px bg-[var(--line)] sm:block" />

                <div className="min-w-0">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
                    {portalLabel}
                  </p>
                  <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                    {portalContext}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>

                <button
                  type="button"
                  onClick={goPublic}
                  className="hidden h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 text-[12px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:inline-flex cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  Public site
                </button>

                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex h-9 items-center rounded-full border border-[var(--line)] px-3.5 text-[12px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            </div>
          </header>

          {/* ======================================================== */}
          {/* A. CREATOR PORTAL                                        */}
          {/* ======================================================== */}
          {viewMode === 'creator' && (
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-0 sm:px-6 sm:py-7">
              <div className="flex flex-1 flex-col overflow-hidden border-[var(--line)] bg-[var(--bg)] sm:min-h-[calc(100vh-7.75rem)] sm:rounded-[22px] sm:border sm:shadow-[var(--shadow-soft)]">
                {isRejected ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--err)]">
                      <User size={22} />
                    </span>
                    <h2 className="font-display mt-5 text-[24px] font-bold">Application not approved</h2>
                    <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--muted)]">
                      We couldn’t verify this profile for the roster. Message onboarding if you think
                      this was a mistake.
                    </p>
                    <button
                      type="button"
                      onClick={signOut}
                      className="mt-6 inline-flex h-11 items-center rounded-full bg-gradient-mhomho px-6 text-[13px] font-bold text-[var(--ink)] cursor-pointer"
                    >
                      Back to the public site
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

                    <div className="flex-1 overflow-y-auto">
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
                              onLogout={goPublic}
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

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {ADMIN_NAV.map((tab) => {
                    const isActive = adminTab === tab.id;
                    const count =
                      tab.id === 'queue'
                        ? queuePendingCount
                        : tab.id === 'enquiries'
                        ? enquiriesCount
                        : tab.id === 'dashboard'
                        ? applicantsCount
                        : 0;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAdminTab(tab.id)}
                        className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[var(--text)] text-[var(--page)]'
                            : 'border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {tab.label}
                        {count > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              isActive
                                ? 'bg-[var(--page)]/15 text-[var(--page)]'
                                : 'bg-[var(--surface-2)] text-[var(--a1)]'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1">
                {adminTab === 'dashboard' && <AdminDashboard db={db} />}
                {adminTab === 'queue' && <AdminVerificationQueue db={db} />}
                {adminTab === 'campaigns' && <AdminCampaigns db={db} />}
                {adminTab === 'payouts' && <AdminPayouts db={db} />}
                {adminTab === 'enquiries' && <AdminEnquiries db={db} />}
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

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleCreatorLogin}
        onApply={() => {
          goPublic();
          window.setTimeout(() => {
            document.getElementById('creators')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }, 80);
        }}
      />
    </div>
  );
}
