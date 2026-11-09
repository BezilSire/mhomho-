import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ShieldCheck } from 'lucide-react';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';

export type LegalDoc = 'terms' | 'privacy';

type LegalBlock =
  | { type: 'p'; content: React.ReactNode }
  | { type: 'ul'; items: React.ReactNode[] }
  | { type: 'callout'; content: React.ReactNode };

interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

interface LegalContent {
  title: string;
  eyebrow: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}

export interface LegalPageProps {
  doc: LegalDoc;
  onBack: () => void;
}

const EFFECTIVE_DATE = '26 October 2026';
const VERSION = '1.0';
const SUPPORT_EMAIL = 'support@mhomho.work';

const TERMS: LegalContent = {
  title: 'Terms of Service',
  eyebrow: 'Legal · Terms',
  intro:
    'These Terms govern your use of Mhomho. Please read them before you create an account, join a campaign, submit a clip or post in the community.',
  sections: [
    {
      id: 'who-we-are',
      title: 'Who we are',
      blocks: [
        {
          type: 'p',
          content:
            'These Terms of Service (“Terms”) are a contract between you and Mhomho Media (“Mhomho”, “we”, “us” or “our”), a media and creator-platform business based in Harare, Zimbabwe. They apply to our website, creator dashboard, community, support centre, brand enquiry forms and any campaign we run (together, the “Service”).',
        },
        {
          type: 'p',
          content:
            'By using the Service, creating an account, submitting a clip, joining a campaign or posting in the community, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the Service.',
        },
        {
          type: 'p',
          content:
            'If you use the Service for a business, you confirm that you have authority to bind that business to these Terms.',
        },
      ],
    },
    {
      id: 'eligibility',
      title: 'Eligibility and account security',
      blocks: [
        {
          type: 'ul',
          items: [
            'You must be at least 18 years old and legally able to enter into a contract.',
            'Give us accurate, current information and keep it up to date.',
            'Keep your login details private. You are responsible for activity under your account, so tell us promptly if you suspect unauthorised access.',
            'Use one account per person unless we agree otherwise in writing. Accounts are personal and may not be sold, rented or shared.',
            'We may ask for information to verify your identity, ownership of a social account or eligibility for a campaign.',
            'We may refuse, suspend or cancel an account where information is false, misleading or breaks these Terms.',
          ],
        },
      ],
    },
    {
      id: 'creator-accounts',
      title: 'Creator accounts and Campaign Zero',
      blocks: [
        {
          type: 'p',
          content:
            'Creator accounts start as applications. Approval is at our discretion and is not guaranteed. We may consider your content, account history, platform rules, niche and fit with the campaigns we run.',
        },
        {
          type: 'p',
          content:
            'Campaign Zero is a qualification step. You have 15 days from sign-up to follow a Mhomho social page, post at least one clip featuring Mhomho (up to three; the other two are optional) and get at least 500 views on one of those clips. We verify the evidence before unlocking the creator dashboard; paid campaigns still require 1,000+ verified views per clip. If the 15-day window expires before you qualify, you may start a new window and try again.',
        },
        {
          type: 'p',
          content:
            'Campaign Zero is not itself a paid campaign unless a campaign brief expressly says so. The clips must be your own, public, and live for the period we specify. We may reject evidence that is incomplete, edited, duplicated or not verifiable.',
        },
        {
          type: 'p',
          content:
            'After approval, you may join campaigns. Some campaigns have additional eligibility requirements, such as platform, niche, location, account status or follower count. Read each brief before joining.',
        },
      ],
    },
    {
      id: 'campaigns',
      title: 'Campaigns, submissions and verification',
      blocks: [
        {
          type: 'ul',
          items: [
            'A campaign brief sets the deliverables, deadlines, content rules, qualifying threshold and rate. Join only if you can meet them.',
            'Submit the final public post URL through the dashboard. Do not submit private, deleted, edited, duplicate or misleading posts.',
            'Every view count is reviewed and verified by a person. We use our verified view count, not a screenshot or platform counter alone, to decide payment.',
            'Views must be genuine and organic. Purchased, incentivised, bot, engagement-pod or otherwise artificial views do not count.',
            'A clip must stay live and public for at least 30 days after posting (or the period stated in the brief) and meet the campaign threshold. Removing or hiding it may make it ineligible.',
            'Payment is also subject to campaign caps, available budget, the campaign terms and these Terms. A submission is not a promise of payment until it is verified and approved.',
            'We may correct errors in view counts, earnings or payouts. If we overpay, we may recover the amount from future earnings or ask you to repay it.',
          ],
        },
        {
          type: 'p',
          content:
            'You participate as an independent creator. Nothing in these Terms makes you an employee, agent, partner or representative of Mhomho or a brand. You are responsible for your own taxes and for complying with the rules of the platforms you use.',
        },
      ],
    },
    {
      id: 'content',
      title: 'Content, ownership and permissions',
      blocks: [
        {
          type: 'p',
          content:
            'You keep ownership of the content you create. You grant Mhomho a non-exclusive, worldwide, royalty-free licence to host, reproduce, distribute, display, adapt for formatting or promotion, and promote your submitted content in connection with the campaign, our reports, our website and our social channels.',
        },
        {
          type: 'p',
          content:
            'That licence lasts for the campaign and for as long as we reasonably need it for reporting, auditing and promoting Mhomho, unless you and we agree otherwise in writing. We will not sell your content as a standalone product.',
        },
        {
          type: 'ul',
          items: [
            'You confirm that you own or have all permissions needed for the content, music, footage, trademarks and other material you use.',
            'Your content must be accurate and not misleading, comply with the law and platform rules, and not infringe anyone’s rights.',
            'If a campaign gives you brand assets, you may use them only for that campaign and only as the brief allows. Stop using them when the campaign ends or we ask you to.',
            'We may remove or refuse content that breaks these Terms, a campaign brief, the law or a platform’s rules.',
          ],
        },
      ],
    },
    {
      id: 'payments',
      title: 'Payments and payouts',
      blocks: [
        {
          type: 'p',
          content:
            'Creator rates are set out in the campaign brief. The base rate is $1.00 per 1,000 verified views, but the final rate depends on the campaign budget and terms.',
        },
        {
          type: 'ul',
          items: [
            'Earnings become available after the campaign closes, after the settlement window shown in your dashboard (currently 72 hours), after the required live period, and after verification.',
            'Payouts are sent manually by the Mhomho team to the EcoCash number in your profile. The minimum payout balance is $5.',
            'Payouts are made in USD through EcoCash or another method we agree. You are responsible for giving us correct payout details. We are not responsible for delays or losses caused by details you provide incorrectly.',
            'We may withhold, offset or reverse amounts linked to invalid views, duplicate submissions, chargebacks, fraud, technical errors or a breach of these Terms.',
            'Payout references and records are kept for accounting and audit purposes.',
          ],
        },
        {
          type: 'p',
          content:
            'Brand fees, payment timing and any refund or make-good terms are agreed separately in writing before a campaign starts.',
        },
      ],
    },
    {
      id: 'brands',
      title: 'Brand services and enquiries',
      blocks: [
        {
          type: 'ul',
          items: [
            'A brand enquiry is a request to discuss a campaign. It does not create a binding campaign until we confirm the scope, budget, delivery plan and payment terms in writing.',
            'You are responsible for the accuracy of your brief, your right to promote the products or services, and the materials you give us.',
            'Delivery targets are based on the plan we agree and depend on creator availability, platform performance, verification and campaign timing. If a target is not met, we will discuss a make-good or adjustment.',
            'Brand reports show aggregate campaign data and do not identify individual creators or their contact details.',
            'You must not ask creators to make false claims, hide that content is paid, or break platform rules.',
          ],
        },
      ],
    },
    {
      id: 'community',
      title: 'Community and forum rules',
      blocks: [
        {
          type: 'p',
          content:
            'The community is for approved creators. Access is granted by us and can be removed. Discussions are visible to other approved creators and our administrators, not the general public.',
        },
        {
          type: 'ul',
          items: [
            'Do not post confidential information, personal data, payment details, passwords or anything you do not want other creators to see.',
            'Be respectful. No harassment, hate speech, threats, doxxing, spam, scams, impersonation, illegal content or content that infringes someone else’s rights.',
            'Do not buy or sell accounts, fake views, engagement, followers or payout details. Do not share a campaign brief that a brand has marked confidential.',
            'Forum posts are plain text. Do not rely on the forum for urgent support; use the support centre or email support@mhomho.work.',
            'We may pin, lock, hide or remove threads and replies, and may suspend community access, to keep the space safe and useful. Moderation decisions are ours.',
          ],
        },
      ],
    },
    {
      id: 'prohibited',
      title: 'Prohibited conduct',
      blocks: [
        {
          type: 'p',
          content: 'You must not use the Service to:',
        },
        {
          type: 'ul',
          items: [
            'break any law or the rules of a social platform, payment provider or other third party;',
            'upload malware, probe or scan our systems, attempt unauthorised access, or disrupt the Service;',
            'scrape, copy, resell or misuse the Service or other users’ data;',
            'create fake accounts or misrepresent your identity, experience or affiliation;',
            'submit fake, purchased, manipulated or automated views or engagement;',
            'post spam, chain messages, phishing content or misleading claims;',
            'infringe intellectual property, privacy or publicity rights;',
            'harass, threaten, defame or discriminate against anyone;',
            'promote illegal goods or services; or',
            'circumvent rate limits, bans, security controls or payment controls.',
          ],
        },
        {
          type: 'p',
          content:
            'We may investigate suspected misuse and report unlawful activity to the relevant authorities.',
        },
      ],
    },
    {
      id: 'termination',
      title: 'Suspension, termination and account deletion',
      blocks: [
        {
          type: 'p',
          content:
            'You may stop using the Service at any time. You can delete your creator account from Profile. Contact us before deleting if you have an available balance; deleting your account writes off unpaid balances.',
        },
        {
          type: 'p',
          content:
            'When you delete your account, we anonymise your profile and contact details, revoke your sessions and remove your access. We keep financial, payout, tax and audit records, and may keep forum content with an anonymised author, as required or permitted by law.',
        },
        {
          type: 'p',
          content:
            'We may suspend, restrict or terminate your account or access if you breach these Terms, if we are required by law, or if your account creates risk for other users, brands or us. Where reasonable, we will tell you why.',
        },
        {
          type: 'p',
          content:
            'Sections that by their nature should survive termination — including payment, content licences, disclaimers, liability, indemnity and governing law — will survive.',
        },
      ],
    },
    {
      id: 'third-parties',
      title: 'Third-party platforms and links',
      blocks: [
        {
          type: 'p',
          content:
            'The Service depends on third-party platforms such as TikTok, Instagram, YouTube, Facebook, WhatsApp, Cloudflare and EcoCash. Their terms and privacy policies apply to your use of them. We do not control their availability, view counts, account decisions or content moderation.',
        },
        {
          type: 'p',
          content:
            'Links to third-party sites are provided for convenience. We are not responsible for their content or practices. You must comply with each platform’s rules, including rules about paid partnerships and disclosure.',
        },
      ],
    },
    {
      id: 'disclaimers',
      title: 'Disclaimers',
      blocks: [
        {
          type: 'p',
          content:
            'We provide the Service on an “as available” basis. To the maximum extent permitted by law, we do not promise that it will be uninterrupted, error-free or secure, or that every campaign will achieve a particular reach or result.',
        },
        {
          type: 'p',
          content:
            'View counts, reach and engagement depend on third-party platforms and audiences. A verified view count is our good-faith measurement for payment, not a guarantee of future performance.',
        },
        {
          type: 'p',
          content:
            'Nothing in these Terms excludes or limits liability for fraud, wilful misconduct, death or personal injury caused by negligence, or any liability that cannot lawfully be excluded.',
        },
      ],
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      blocks: [
        {
          type: 'p',
          content:
            'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential or punitive loss, or for loss of profits, revenue, audience, data, goodwill or opportunity, even if we were told it was possible.',
        },
        {
          type: 'p',
          content:
            'Our total liability for all claims relating to the Service in any 12-month period is limited to the greater of: (a) USD 100; or (b) the total amount we paid or were obliged to pay you (for creators) or you paid us (for brands) under the relevant campaign in the three months before the claim.',
        },
        {
          type: 'p',
          content: 'These limits do not apply where the law does not allow them.',
        },
      ],
    },
    {
      id: 'indemnity',
      title: 'Indemnity',
      blocks: [
        {
          type: 'p',
          content:
            'To the extent permitted by law, you agree to indemnify and hold Mhomho harmless from claims, losses, liabilities, damages, costs and reasonable legal fees arising from your content, your breach of these Terms, your violation of law or third-party rights, or your misuse of the Service.',
        },
        {
          type: 'p',
          content:
            'We will tell you about a claim and may ask you to cooperate. We may choose to defend it ourselves.',
        },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to these Terms',
      blocks: [
        {
          type: 'p',
          content:
            'We may update these Terms as the Service changes or the law requires. The updated version will show a new effective date. If a change is material, we will give reasonable notice in the app or by email before it takes effect.',
        },
        {
          type: 'p',
          content:
            'Continued use after the effective date means you accept the updated Terms. If you do not agree, stop using the Service and, if you wish, delete your account.',
        },
      ],
    },
    {
      id: 'law',
      title: 'Governing law and disputes',
      blocks: [
        {
          type: 'p',
          content:
            'These Terms are governed by the laws of Zimbabwe. Before starting formal proceedings, please contact us so we can try to resolve the issue informally. If we cannot resolve it, the courts of Zimbabwe have jurisdiction, except where the law gives you the right to bring a claim elsewhere.',
        },
        {
          type: 'p',
          content:
            'If any provision is unenforceable, the rest remains in effect. Our failure to enforce a provision is not a waiver. You may not assign your rights or obligations without our written consent; we may assign ours as part of a merger, acquisition or sale of assets.',
        },
      ],
    },
    {
      id: 'contact',
      title: 'Contact us',
      blocks: [
        {
          type: 'callout',
          content: (
            <>
              Questions about these Terms? Email{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-[var(--text)] underline decoration-[var(--a1)]/50 underline-offset-4 hover:decoration-[var(--a1)]"
              >
                {SUPPORT_EMAIL}
              </a>
              , use Support in your creator dashboard, or write to Mhomho Media, Harare,
              Zimbabwe. Include your name and the email or handle on your account so we can help
              quickly.
            </>
          ),
        },
      ],
    },
  ],
};

const PRIVACY: LegalContent = {
  title: 'Privacy Policy',
  eyebrow: 'Legal · Privacy',
  intro:
    'How Mhomho collects, uses, shares and protects personal information — and the choices you have over it.',
  sections: [
    {
      id: 'who-we-are',
      title: 'Who we are and what this policy covers',
      blocks: [
        {
          type: 'p',
          content:
            'This Privacy Policy explains how Mhomho Media (“Mhomho”, “we”, “us” or “our”) handles personal information when you use our website, creator platform, brand enquiry forms, support centre and community (together, the “Service”).',
        },
        {
          type: 'p',
          content:
            'Mhomho Media is the controller of that information. We are based in Harare, Zimbabwe. Our contact details are at the end of this policy.',
        },
        {
          type: 'p',
          content:
            'This policy does not cover third-party websites or apps, including TikTok, Instagram, YouTube, Facebook, WhatsApp, Cloudflare and EcoCash. Those services have their own privacy policies.',
        },
      ],
    },
    {
      id: 'what-we-collect',
      title: 'What we collect',
      blocks: [
        {
          type: 'p',
          content: 'We collect the following categories of information:',
        },
        {
          type: 'ul',
          items: [
            'Account details: name, email address, handle, platform, niche, follower count, WhatsApp number, password (stored as a salted hash, never in plain text), account status and application or Campaign Zero details.',
            'Profile and community details: your chosen preset avatar, community handle, forum threads and replies, and support messages.',
            'Campaign and content details: campaigns joined, submitted clip URLs, claimed views, proof screenshots, review and verification notes, campaign performance and earnings records.',
            'Payout details: EcoCash number, masked payout destination, payout records, references, status and transaction history.',
            'Brand enquiry details: business and contact names, phone number, industry, what you want to promote, goals, budget, timing and any notes you provide.',
            'Technical and security information: a keyed hash of your IP address (we do not store the raw address in our application database), a hash of your browser user-agent, session records, request IDs, rate-limit counters and audit events.',
            'Communications: if you email us, we receive your email address and the messages you send. If we contact you on WhatsApp using the number you provide, WhatsApp/Meta handles that communication under its own privacy policy.',
          ],
        },
        {
          type: 'p',
          content:
            'We do not ask for payment card details. We do not collect precise location, your phone contacts, your photo library or advertising identifiers. Avatars are chosen from a set of presets; there is no profile-photo upload.',
        },
      ],
    },
    {
      id: 'how-we-use',
      title: 'How we use your information',
      blocks: [
        {
          type: 'ul',
          items: [
            'Create and manage accounts, verify eligibility and administer Campaign Zero.',
            'Match creators to campaigns and run campaigns, including reviewing submissions and verifying views.',
            'Calculate earnings, process payouts and keep financial records.',
            'Operate the community, notifications and support centre.',
            'Respond to brand enquiries and prepare campaign plans.',
            'Detect and prevent fraud, fake views, abuse, spam and security incidents.',
            'Maintain audit, accounting, tax and legal records.',
            'Comply with law and enforce our Terms of Service.',
            'Understand and improve how the Service performs, using aggregated information where possible.',
          ],
        },
        {
          type: 'p',
          content:
            'We do not sell your personal information or use it for third-party behavioural advertising.',
        },
      ],
    },
    {
      id: 'lawful-bases',
      title: 'Our lawful bases',
      blocks: [
        {
          type: 'p',
          content:
            'We process personal information under the following bases recognised by Zimbabwe’s data protection law:',
        },
        {
          type: 'ul',
          items: [
            'Contract: to create your account, run campaigns, verify views and pay you.',
            'Consent: for optional communications or features where we ask for your permission.',
            'Legal obligation: to keep financial, tax and audit records or respond to lawful requests.',
            'Legitimate interests: to secure the Service, prevent fraud, moderate the community and improve what we do, balanced against your rights.',
          ],
        },
        {
          type: 'p',
          content:
            'You can withdraw consent at any time. That does not affect processing we already carried out.',
        },
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies and similar technologies',
      blocks: [
        {
          type: 'p',
          content:
            'We use one essential session cookie, __Host-mhomho_session on HTTPS (or mhomho_session in local development). It keeps you signed in, is HttpOnly, uses SameSite=Lax and expires when your session ends or after the session lifetime.',
        },
        {
          type: 'p',
          content:
            'The app keeps session details and a CSRF token in memory only. Closing the tab clears them. We do not use localStorage or sessionStorage for login, and we do not use advertising, analytics or tracking cookies or pixels.',
        },
        {
          type: 'p',
          content:
            'Google Fonts is loaded from Google’s servers, which receive your IP address and browser information. WhatsApp/Meta handles any WhatsApp communication you choose to use. Cloudflare serves the site and may process technical request data as our hosting provider. Blocking the session cookie will stop you from signing in, but you can otherwise control cookies in your browser.',
        },
      ],
    },
    {
      id: 'sharing',
      title: 'Who can see your information',
      blocks: [
        {
          type: 'p',
          content: 'We share personal information only where there is a reason to do so:',
        },
        {
          type: 'ul',
          items: [
            'Cloudflare, for hosting, database storage, file storage and security.',
            'Google Fonts, for font delivery.',
            'WhatsApp/Meta, when we contact you on WhatsApp using the number you provide.',
            'EcoCash or another mobile-money provider, to process a payout you request.',
            'Social platforms, when you submit a public post or we review it. We do not send your account details to those platforms.',
            'Our administrators and support staff, who access information only when they need it to run the Service.',
            'Professional advisers such as lawyers, accountants and auditors, under confidentiality obligations.',
            'Authorities, courts or regulators where required by law, or where necessary to protect rights, safety or the integrity of the Service.',
            'A successor in a merger, acquisition or sale of assets, subject to this policy.',
          ],
        },
        {
          type: 'p',
          content:
            'Brand reports contain aggregate campaign data only. Brands do not receive your email address, WhatsApp number, EcoCash details or identity.',
        },
        {
          type: 'p',
          content:
            'Approved creators can see your community handle, preset avatar, platform, niche, leaderboard verified views and forum posts. The public may see limited recent-join activity (first name and platform) and public campaign information. Forum posts are not visible to the general public.',
        },
        {
          type: 'p',
          content:
            'We do not sell personal information or share it for third-party behavioural advertising.',
        },
      ],
    },
    {
      id: 'international-transfers',
      title: 'International transfers',
      blocks: [
        {
          type: 'p',
          content:
            'Cloudflare operates globally, so your information may be stored or processed outside Zimbabwe. Where that happens, we take reasonable steps to ensure recipients are bound by confidentiality and data-protection obligations consistent with applicable law. Contact us if you would like more information about the safeguards we use.',
        },
      ],
    },
    {
      id: 'retention',
      title: 'How long we keep information',
      blocks: [
        {
          type: 'ul',
          items: [
            'Accounts and profiles: while your account is active. If you delete your account, we anonymise your profile and contact details, but retain records we need for financial, audit, tax, fraud-prevention and legal purposes.',
            'Financial, payout and audit records: for as long as needed to meet legal, accounting, audit and fraud-prevention obligations.',
            'Proof screenshots: for as long as needed to verify a campaign, handle a dispute and maintain an audit trail.',
            'Forum content and support messages: while the community or support relationship is active. Hidden content may be retained for moderation.',
            'Brand enquiries: until no longer needed for the enquiry or relationship. Deletion is currently a manual process, so you can ask us to remove an enquiry.',
            'Sessions: purged 7 days after expiry or revocation.',
            'Rate-limit and security counters: typically 24 hours, with audit records retained for longer where needed for security.',
          ],
        },
        {
          type: 'p',
          content:
            'When we no longer need information, we delete it or anonymise it. Some data may remain in backups for a limited period.',
        },
      ],
    },
    {
      id: 'security',
      title: 'How we protect information',
      blocks: [
        {
          type: 'p',
          content:
            'We use HTTPS, HttpOnly session cookies, salted PBKDF2 password hashing, server-side access checks, rate limits, audit logs, hashed IP addresses and access controls on our cloud storage.',
        },
        {
          type: 'p',
          content:
            'No system is completely secure. Keep your password private, use a unique password, and tell us promptly if you suspect suspicious activity. Do not send passwords, one-time codes or payout details in the community forum.',
        },
      ],
    },
    {
      id: 'your-rights',
      title: 'Your rights',
      blocks: [
        {
          type: 'p',
          content: 'Subject to applicable law, you can:',
        },
        {
          type: 'ul',
          items: [
            'ask for a copy of the personal information we hold about you;',
            'ask us to correct information that is inaccurate or incomplete;',
            'ask us to delete information, subject to records we must keep;',
            'object to or ask us to restrict certain processing;',
            'withdraw consent where we rely on consent; and',
            'ask how your information is shared and protected.',
          ],
        },
        {
          type: 'p',
          content: (
            <>
              To exercise a right, use Support in your dashboard or email{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-[var(--text)] underline decoration-[var(--a1)]/50 underline-offset-4 hover:decoration-[var(--a1)]"
              >
                {SUPPORT_EMAIL}
              </a>
              . We may need to verify your identity. We will respond within a reasonable period and
              as required by law.
            </>
          ),
        },
        {
          type: 'p',
          content:
            'Some rights are limited where we must keep records for legal, financial, audit or fraud-prevention reasons, or where the rights of another person would be affected.',
        },
      ],
    },
    {
      id: 'complaints',
      title: 'Complaints',
      blocks: [
        {
          type: 'p',
          content:
            'If you are unhappy with how we handle your information, please contact us first so we can try to resolve it. You can also complain to the Postal and Telecommunications Regulatory Authority of Zimbabwe (POTRAZ), which oversees data protection in Zimbabwe.',
        },
      ],
    },
    {
      id: 'children',
      title: 'Children and teenagers',
      blocks: [
        {
          type: 'p',
          content:
            'The Service is for people aged 18 and over. We do not knowingly collect personal information from children. If you believe a child has created an account, contact us and we will investigate and delete the information as appropriate.',
        },
      ],
    },
    {
      id: 'marketing',
      title: 'Marketing and automated decisions',
      blocks: [
        {
          type: 'p',
          content:
            'We send service messages about campaigns, verification, payouts, security and account updates as part of the Service. We do not currently send marketing emails. If we introduce marketing, we will ask for consent or provide an opt-out.',
        },
        {
          type: 'p',
          content:
            'View verification is manual. The community leaderboard is calculated automatically from verified views. We do not currently use automated decision-making that produces legal or similarly significant effects about you. If that changes, we will explain it.',
        },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      blocks: [
        {
          type: 'p',
          content:
            'We may update this policy as the Service or the law changes. The updated version will show a new effective date. If a change is material, we will give reasonable notice in the app or by email before it takes effect.',
        },
      ],
    },
    {
      id: 'contact',
      title: 'Contact us',
      blocks: [
        {
          type: 'callout',
          content: (
            <>
              Privacy questions or requests? Email{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-semibold text-[var(--text)] underline decoration-[var(--a1)]/50 underline-offset-4 hover:decoration-[var(--a1)]"
              >
                {SUPPORT_EMAIL}
              </a>
              , use Support in your creator dashboard, or write to Mhomho Media, Harare,
              Zimbabwe. Include your name and the email or handle on your account.
            </>
          ),
        },
      ],
    },
  ],
};

const CONTENT: Record<LegalDoc, LegalContent> = {
  terms: TERMS,
  privacy: PRIVACY,
};

const LEGAL_LINKS: { doc: LegalDoc; label: string; href: string }[] = [
  { doc: 'terms', label: 'Terms of Service', href: '#/terms' },
  { doc: 'privacy', label: 'Privacy Policy', href: '#/privacy' },
];

function TocList({
  sections,
  onJump,
}: {
  sections: LegalSection[];
  onJump: (id: string) => void;
}) {
  return (
    <ol className="space-y-1">
      {sections.map((section, index) => (
        <li key={section.id}>
          <button
            type="button"
            onClick={() => onJump(section.id)}
            className="group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] leading-snug text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
          >
            <span className="mt-px w-4 shrink-0 text-[10px] font-semibold tabular-nums text-[var(--faint)] group-hover:text-[var(--a1)]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{section.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function LegalBlocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'ul') {
          return (
            <ul key={index} className="mt-4 space-y-2.5">
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="flex items-start gap-2.5 text-[14px] leading-[1.75] text-[var(--muted)]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--a1)]"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'callout') {
          return (
            <div
              key={index}
              className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 text-[13.5px] leading-[1.7] text-[var(--muted)] sm:px-5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--a1)]/10 text-[var(--a1)]">
                <ShieldCheck size={16} />
              </span>
              <p className="m-0">{block.content}</p>
            </div>
          );
        }

        return (
          <p key={index} className="mt-4 text-[14px] leading-[1.8] text-[var(--muted)]">
            {block.content}
          </p>
        );
      })}
    </>
  );
}

export const LegalPage: React.FC<LegalPageProps> = ({ doc, onBack }) => {
  const content = CONTENT[doc];

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--text)]">
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--page)]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-5 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center text-inherit cursor-pointer"
            aria-label="Mhomho Media home"
          >
            <MhomhoLogo className="h-10 w-auto sm:h-11" />
          </button>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <nav aria-label="Legal documents" className="flex items-center gap-1">
              {LEGAL_LINKS.map((link) => {
                const active = link.doc === doc;
                return (
                  <a
                    key={link.doc}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex h-9 items-center rounded-full px-2.5 text-[11.5px] font-semibold transition-colors no-underline sm:px-3.5 sm:text-[12px] ${
                      active
                        ? 'bg-[var(--surface-2)] text-[var(--text)]'
                        : 'text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {link.doc === 'terms' ? 'Terms' : 'Privacy'}
                  </a>
                );
              })}
            </nav>

            <span className="hidden h-5 w-px bg-[var(--line)] sm:block" />

            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[12px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer sm:px-3.5"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Back to site</span>
              <span className="sm:hidden">Back</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[var(--line)]">
          <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[460px] opacity-80" />
          <div className="relative mx-auto w-full max-w-[1200px] px-5 pb-12 pt-14 sm:px-8 sm:pb-16 sm:pt-20">
            <div className="max-w-[780px]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)]/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] backdrop-blur">
                <span className="h-1 w-1 rounded-full bg-[var(--a1)]" />
                {content.eyebrow}
              </span>

              <h1 className="font-display mt-5 text-[40px] font-bold leading-[0.98] tracking-[-0.04em] sm:text-[58px]">
                {content.title}
              </h1>

              <p className="mt-5 max-w-[62ch] text-[15px] leading-[1.8] text-[var(--muted)] sm:text-[16px]">
                {content.intro}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] font-medium text-[var(--faint)]">
                <span>Effective {EFFECTIVE_DATE}</span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--line-strong)]" />
                <span>Version {VERSION}</span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--line-strong)]" />
                <span>Mhomho Media · Harare, Zimbabwe</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <details className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 lg:hidden">
              <summary className="cursor-pointer text-[12px] font-semibold text-[var(--text)]">
                On this page
              </summary>
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <TocList sections={content.sections} onJump={jumpTo} />
              </div>
            </details>

            <div className="hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 lg:block">
              <p className="px-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--faint)]">
                On this page
              </p>
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <TocList sections={content.sections} onJump={jumpTo} />
              </div>
            </div>
          </aside>

          <article className="min-w-0 max-w-[760px]">
            {content.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24 border-b border-[var(--line)] pb-9 pt-1 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1 w-7 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--a1)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-display text-[23px] font-bold leading-tight tracking-[-0.02em] sm:text-[26px]">
                    {section.title}
                  </h2>
                </div>

                <div className="sm:pl-10">
                  <LegalBlocks blocks={section.blocks} />
                </div>
              </section>
            ))}

            <div className="mt-9 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center">
              <p className="max-w-[54ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
                Read the {doc === 'terms' ? 'Privacy Policy' : 'Terms of Service'} as well — together
                they explain the rules and how we handle your information.
              </p>
              <a
                href={doc === 'terms' ? '#/privacy' : '#/terms'}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-4 text-[12px] font-semibold text-[var(--text)] no-underline transition-colors hover:border-[var(--muted)]"
              >
                {doc === 'terms' ? 'Privacy Policy' : 'Terms of Service'}
                <ArrowRight size={13} />
              </a>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--line)] pt-5">
              <p className="text-[11px] leading-relaxed text-[var(--faint)]">
                This document should be read together with our{' '}
                {doc === 'terms' ? 'Privacy Policy' : 'Terms of Service'}. If anything is unclear,
                contact us before using the Service.
              </p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
              >
                Back to top
                <ArrowUp size={13} />
              </button>
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-5 py-6 text-[11.5px] text-[var(--faint)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Mhomho Media. All rights reserved.</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="#/terms" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
              Terms of Service
            </a>
            <a href="#/privacy" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
              Privacy Policy
            </a>
            <span>Built in Harare, for Zimbabwe.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
