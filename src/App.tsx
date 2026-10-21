/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  DatabaseState,
  getDatabaseState,
  subscribeToDatabase,
  UserRole,
  resetDatabaseToSeeds,
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
import { LandingPage } from './screens/public/LandingPage.tsx';
import { LoginModal } from './screens/auth/LoginModal.tsx';
import { TabBar, CreatorTabId } from './components/TabBar.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { runMoneyTests } from './lib/moneyTests.ts';

export type MainViewMode = 'landing' | 'creator' | 'admin' | 'brand';
export type AdminTabId = 'dashboard' | 'queue' | 'campaigns' | 'payouts' | 'enquiries';

export default function App() {
  const [db, setDb] = useState<DatabaseState>(getDatabaseState());
  // Starts directly on the public facing site as requested
  const [viewMode, setViewMode] = useState<MainViewMode>('landing');
  const [currentCreatorUid, setCurrentCreatorUid] = useState<string>('tendai_uid');

  // Creator portal navigation state
  const [creatorTab, setCreatorTab] = useState<CreatorTabId>('home');
  const [activeCampaignDetailId, setActiveCampaignDetailId] = useState<string | null>(null);
  const [isSubmittingClip, setIsSubmittingClip] = useState<boolean>(false);
  const [submitClipCampaignId, setSubmitClipCampaignId] = useState<string | undefined>(undefined);

  // Admin portal navigation state
  const [adminTab, setAdminTab] = useState<AdminTabId>('dashboard');

  // Brand token dashboard state
  const [brandToken, setBrandToken] = useState<string>('glow-skincare');

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Modals
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showTestsModal, setShowTestsModal] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<{ name: string; passed: boolean; error?: string }[]>([]);

  // Subscribe to real-time local storage/database state
  useEffect(() => {
    const unsubscribe = subscribeToDatabase(() => {
      setDb({ ...getDatabaseState() });
    });
    return unsubscribe;
  }, []);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleOpenTests = () => {
    const results = runMoneyTests();
    setTestResults(results);
    setShowTestsModal(true);
  };

  const handleCreatorApplySuccess = (newUid: string) => {
    setCurrentCreatorUid(newUid);
    setViewMode('creator');
    setCreatorTab('home');
    setActiveCampaignDetailId(null);
    setIsSubmittingClip(false);
  };

  const currentCreator = db.creatorsPublic[currentCreatorUid];
  const isAppliedStatus = currentCreator?.status === 'applied';

  // Badge counters
  const queuePendingCount = Object.values(db.clips).filter((c) => c.status === 'submitted').length;
  const enquiriesCount = Object.values(db.enquiries).filter((e) => e.status === 'new').length;

  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--text)] font-montserrat flex flex-col">
      <OfflineIndicator />

      {/* ======================================================== */}
      {/* 1. PUBLIC FACING SITE (Default on launch)                */}
      {/* ======================================================== */}
      {viewMode === 'landing' ? (
        <LandingPage
          db={db}
          onCreatorApplySuccess={handleCreatorApplySuccess}
          onOpenPortal={(role, uid) => {
            if (role === 'admin') {
              setViewMode('admin');
            } else if (role === 'brand') {
              setViewMode('brand');
            } else {
              setViewMode('creator');
              if (uid) setCurrentCreatorUid(uid);
            }
          }}
          onOpenSignIn={() => setShowLoginModal(true)}
        />
      ) : (
        /* ======================================================== */
        /* 2. AUTHENTICATED RESPONSIVE WEB APPLICATION PORTAL       */
        /* ======================================================== */
        <div className="min-h-screen flex flex-col bg-[var(--page)]">
          {/* Web App Global Top Bar */}
          <header className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--line)] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setViewMode('landing')}
                className="flex items-center gap-2 text-inherit font-extrabold text-[15px] tracking-[0.05em] hover:opacity-80 cursor-pointer"
                title="Return to Public Site"
              >
                <span className="text-[17px] text-[var(--a1)]">←</span>
                <span>MHOMHO</span>
              </button>

              <div className="h-4 w-px bg-[var(--line)] hidden sm:block" />

              {/* Portal Context Indicator */}
              <div className="text-[12px] font-semibold text-[var(--muted)] flex items-center gap-2">
                <span>Portal:</span>
                <span className="text-[var(--text)] font-bold">
                  {viewMode === 'creator' && (isAppliedStatus ? 'Applicant (Review)' : `Creator (${currentCreator?.handle || '@creator'})`)}
                  {viewMode === 'admin' && 'Admin Console'}
                  {viewMode === 'brand' && 'Brand View (/c/glow-skincare)'}
                </span>
              </div>
            </div>

            {/* Quick Persona / Role Switcher for seamless testing */}
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-1 bg-[var(--bg)] p-1 rounded-[8px] border border-[var(--line)] text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('creator');
                    setCurrentCreatorUid('tendai_uid');
                  }}
                  className={`px-2.5 py-1 rounded-[5px] transition-colors cursor-pointer ${
                    viewMode === 'creator' && currentCreatorUid === 'tendai_uid'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-bold'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Creator: Tendai
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('creator');
                    setCurrentCreatorUid('newbie_uid');
                  }}
                  className={`px-2.5 py-1 rounded-[5px] transition-colors cursor-pointer ${
                    viewMode === 'creator' && currentCreatorUid === 'newbie_uid'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-bold'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Applicant: Kudzai
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('admin')}
                  className={`px-2.5 py-1 rounded-[5px] transition-colors cursor-pointer ${
                    viewMode === 'admin'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-bold'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Admin
                  {queuePendingCount > 0 && (
                    <span className="ml-1 px-1 bg-[var(--warn)] text-[var(--ink)] rounded-full text-[9px] font-bold">
                      {queuePendingCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('brand')}
                  className={`px-2.5 py-1 rounded-[5px] transition-colors cursor-pointer ${
                    viewMode === 'brand'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-bold'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Brand View
                </button>
              </div>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="px-2.5 py-1.5 rounded-[8px] border border-[var(--line)] text-[12px] font-semibold hover:bg-[var(--surface)] cursor-pointer"
                title="Toggle Theme"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>

              {/* Money Tests status badge */}
              <button
                type="button"
                onClick={handleOpenTests}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] border border-[var(--line)] text-[12px] font-semibold text-[var(--ok)] hover:bg-[var(--surface)] cursor-pointer"
                title="Run Money Maths Tests"
              >
                <span>✓</span> Tests
              </button>

              {/* Return to Public Site */}
              <button
                type="button"
                onClick={() => setViewMode('landing')}
                className="px-3 py-1.5 rounded-[8px] bg-[var(--surface)] border border-[var(--line)] text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              >
                Public Site
              </button>
            </div>
          </header>

          {/* ======================================================== */}
          {/* A. CREATOR PORTAL VIEW (Responsive, Clean Frame)         */}
          {/* ======================================================== */}
          {viewMode === 'creator' && (
            <div className="flex-1 flex flex-col justify-between max-w-xl w-full mx-auto sm:my-6 sm:border sm:border-[var(--line)] sm:rounded-[18px] bg-[var(--bg)] shadow-none sm:shadow-lg overflow-hidden">
              {isAppliedStatus ? (
                <UnderReviewScreen
                  db={db}
                  currentUid={currentCreatorUid}
                  onApproved={() => {
                    setCreatorTab('home');
                  }}
                  onLogout={() => setViewMode('landing')}
                />
              ) : isSubmittingClip ? (
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
                  <div className="flex-1 overflow-y-auto">
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
                        onLogout={() => setViewMode('landing')}
                      />
                    )}
                  </div>

                  <TabBar
                    activeTab={creatorTab}
                    onTabChange={(tab) => {
                      setActiveCampaignDetailId(null);
                      setIsSubmittingClip(false);
                      setCreatorTab(tab);
                    }}
                  />
                </>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* B. ADMIN CONSOLE VIEW (Spacious Desktop Dashboard)       */}
          {/* ======================================================== */}
          {viewMode === 'admin' && (
            <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
              {/* Admin Navigation Pills */}
              <div className="flex items-center gap-1.5 pb-4 mb-4 border-b border-[var(--line)] overflow-x-auto text-[13px]">
                <button
                  type="button"
                  onClick={() => setAdminTab('dashboard')}
                  className={`px-3.5 py-1.5 rounded-[8px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    adminTab === 'dashboard'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-extrabold'
                      : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--line)]'
                  }`}
                >
                  Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTab('queue')}
                  className={`px-3.5 py-1.5 rounded-[8px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    adminTab === 'queue'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-extrabold'
                      : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--line)]'
                  }`}
                >
                  Verification Queue
                  {queuePendingCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-[var(--warn)] text-[var(--ink)] rounded-full text-[10px] font-bold">
                      {queuePendingCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTab('campaigns')}
                  className={`px-3.5 py-1.5 rounded-[8px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    adminTab === 'campaigns'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-extrabold'
                      : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--line)]'
                  }`}
                >
                  Campaigns
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTab('payouts')}
                  className={`px-3.5 py-1.5 rounded-[8px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    adminTab === 'payouts'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-extrabold'
                      : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--line)]'
                  }`}
                >
                  EcoCash Payouts
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTab('enquiries')}
                  className={`px-3.5 py-1.5 rounded-[8px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    adminTab === 'enquiries'
                      ? 'bg-[var(--grad)] text-[var(--ink)] font-extrabold'
                      : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--line)]'
                  }`}
                >
                  Brand Inquiries
                  {enquiriesCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-[var(--ok)] text-[var(--ink)] rounded-full text-[10px] font-bold">
                      {enquiriesCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Sub-screen rendering */}
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
          {/* C. BRAND CAMPAIGN VIEW (/c/:token)                       */}
          {/* ======================================================== */}
          {viewMode === 'brand' && (
            <div className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col justify-center">
              <BrandCampaignPage
                token={brandToken}
                db={db}
                onSelectToken={(newToken) => setBrandToken(newToken)}
              />
            </div>
          )}
        </div>
      )}

      {/* Sign In Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={({ role, uid }) => {
          if (role === 'admin') {
            setViewMode('admin');
          } else {
            setViewMode('creator');
            setCurrentCreatorUid(uid);
          }
        }}
      />

      {/* Money Tests Modal */}
      {showTestsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-5 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[18px] font-extrabold m-0">
                Money Maths Unit Tests
              </h3>
              <button
                type="button"
                onClick={() => setShowTestsModal(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] text-[20px] font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[13px] text-[var(--muted)] mb-3">
              Verifies Section 9 rules: $250 campaign $\to$ 16,666¢ pool, 4,166¢ cap, 166,666 views, rounding down, 80% pool closure, and ceiling.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4 text-[13px]">
              {testResults.map((t, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-[8px] border flex items-start gap-2 ${
                    t.passed
                      ? 'bg-[var(--ok)]/10 text-[var(--ok)] border-[var(--ok)]/30'
                      : 'bg-[var(--err)]/10 text-[var(--err)] border-[var(--err)]/30'
                  }`}
                >
                  <span className="font-extrabold">{t.passed ? '✓' : '✗'}</span>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    {t.error && <div className="text-[11px] mt-0.5">{t.error}</div>}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowTestsModal(false)}
              className="w-full py-2.5 rounded-[10px] bg-[var(--line)] text-[var(--text)] font-semibold text-[14px] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
