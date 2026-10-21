# Implementation Plan - Mhomho Media Web Application Restructure

Refactor the application architecture so that Mhomho Media functions as a true, production-grade web application: starting at the public-facing site, transitioning seamlessly into the authenticated creator and admin portals without artificial phone frames or intrusive iOS install popups, while preserving strict token styling and verified money math.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed via interactive user clarification:
> - **Default Entry Point**: The app will launch directly into the public-facing website (`Activate your own crowd.`) featuring the value proposition, comparison table, research paper reader, brand quote wizard, and creator sign-up.
> - **Sign-In & Portal Access**: A clean top navigation bar on the public site provides seamless access ("Sign In" / "Creator & Admin Portal" / "View Demo Portal").
> - **No Artificial Phone Bezel**: All logged-in screens (Creator Home, Campaigns, Verification Queue, Admin Dashboard, Brand View) will render as a responsive web application layout (fluid on mobile, elegantly framed container on desktop/tablet) rather than a fixed 360px simulated mobile phone mockup.
> - **Zero iOS / PWA Nagging**: Completely remove all artificial iOS installation modals, install banners, and PWA prompts to keep the web application experience clean, direct, and distraction-free.

---

## 1. Overview & Core Concept

**Mhomho Media** is Zimbabwe's performance-based creator distribution platform. Instead of paying comedians flat fees for unverified posts, Zimbabwean brands buy guaranteed reach delivered by hundreds of niche creators who are paid upon delivering verified views (minimum 1,000 views per post).

### Target Personas:
1. **Public Visitors & Brands**: Arrive at the landing page, explore the comparison against flat-fee influencers, read the research paper, and submit campaign briefs through the interactive wizard.
2. **Creators**: Sign up for Campaign Zero, submit clip links with analytics proof, track verified views, and withdraw earnings directly to EcoCash once approved.
3. **Mhomho Admin**: Review creator applications, verify clips against public view counts with automated $5\times$ spike detection, manage campaign budgets, and execute EcoCash payouts.
4. **Brands (Private Link `/c/:token`)**: Read-only dashboard showing real-time guaranteed view fulfillment ring, budget consumption, live clips, and WhatsApp touchpoints.

---

## 2. User Experience & Visual Design

### A. Navigation & Information Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC FACING WEBSITE                           │
│  [MHOMHO Logo]          [Brand Solutions]   [Research]   [Sign In]     │
├────────────────────────────────────────────────────────────────────────┤
│  - Hero: "Activate your own crowd."                                    │
│  - Campaign Zero Creator Sign-up Form (Name, Handle, Platform, etc.)   │
│  - Comparison Matrix: Flat-fee Influencer vs Mhomho Performance         │
│  - Interactive Brand Discovery Wizard (6 steps -> Brief -> WhatsApp)   │
│  - Research Paper Reader ("Rethinking Influencer Distribution in Zim") │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ (Sign In / Switch to App)
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATED WEB APPLICATION                        │
│  [Brand Logo]   [Active Role Indicator]   [Theme Toggle]   [Sign Out]  │
├────────────────────────────────────────────────────────────────────────┤
│  CREATOR PORTAL                   ADMIN CONSOLE                        │
│  - Status: Applied/Approved       - Verification Queue (Spike check)   │
│  - Home: Owed / Paid / Active     - Campaign Zero Funnel (420->41)     │
│  - Campaigns Feed (Niches)        - Campaign Creation & Budget Top Up  │
│  - Campaign Detail & Briefs       - EcoCash Payout Settlement          │
│  - Submit Clip & Proof            - Brand Inquiries Inbox              │
│  - Earnings Breakdown                                                  │
│                                                                        │
│  BRAND PRIVATE DASHBOARD (/c/:token)                                   │
│  - Delivery Progress Ring (67%), Budget Bar, Views-over-time Chart     │
└────────────────────────────────────────────────────────────────────────┘
```

### B. Visual Identity & Styling Rules
- **Design Tokens (`src/styles/tokens.css`)**: Preserves all `:root` tokens:
  - Backgrounds: `--page` (`#0B0A09` dark / `#EFE9E3` light), `--surface` (`#111010` / `#ffffff`), `--line` (`#2B2622` / `#E3DBD3`).
  - Typography: Pure Montserrat weights (400, 600, 800) with muted grey (`--muted`) for secondary copy.
  - Accent Gradient: `--grad` (`linear-gradient(90deg, #FF9F0A, #F0191B)`) reserved strictly for primary buttons, progress indicators, and single key metric numbers per view.
  - Cards: 14px radius (`--r-card`), hairline border, zero drop-shadows.
  - Status Indicators: Always text-accompanied tags (`ok` green, `warn` amber, `err` red).

---

## 3. Key Technical Architecture & Implementation Steps

### Step 1: Default to Public Facing Site as Root Entry
- Update `src/App.tsx` so the initial `viewMode` is `'landing'` (the public site).
- Add a prominent, polished "Sign In / Portal" button in the header so existing creators, applicants, and admins can immediately log in or switch into their respective app consoles.
- Integrate the creator sign-up on the public site directly into the state store so that submitting Campaign Zero immediately logs them in with `"applied"` status and transitions them to their personal portal ("Under Review").

### Step 2: Strip Artificial Phone Frame & Remove iOS / PWA Prompts
- Remove the artificial 360px $\times$ 720px rounded mobile bezel container from the app portal.
- Replace it with a desktop-grade, responsive layout:
  - Max-width container (`max-w-4xl` or `max-w-5xl` for admin consoles; `max-w-xl` centered mobile-responsive layout for creator screens).
  - Clean web-native top navigation and responsive creator tab bar.
- Remove `PWAInstallButton`, iOS Safari step-by-step guides, and install prompt handlers entirely.

### Step 3: Streamline Portal Navigation & Role Switching
- **Top Navigation in App Portal**:
  - Wordmark (`MHOMHO`) with active role indicator.
  - Role switcher dropdown or tabs (Creator: Tendai, Applicant: Kudzai, Admin, Brand view) to easily test each persona.
  - Quick action to return to the public site at any time.
- **Creator Experience**:
  - If status is `applied`, displays the clean "Under Review" state with clear next steps.
  - If status is `approved`, full access to Home, Campaigns, Submit Clip, My Clips, and Earnings.
- **Admin Experience**:
  - Full-width desktop-optimized table/card layout for Verification Queue, Dashboard Funnel, Campaigns, EcoCash Payouts, and Inquiries.

### Step 4: Verification & Automated Money Math Integrity
- Ensure `src/lib/money.ts` and `tests/money.test.ts` remain intact with all 15 test assertions passing ($250 campaign $\to$ 16,666¢ pool, 4,166¢ cap, 166,666 guaranteed views, 80% pool closure).
- Re-run `lint_applet` and `compile_applet` to verify compilation.
