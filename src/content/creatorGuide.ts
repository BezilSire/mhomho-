/**
 * The creator guide is the single source of truth for both the web page and
 * the downloadable PDF. Keep this copy aligned with the live creator rules.
 */
export const GUIDE_PDF_URL = '/download/mhomho-creator-guide.pdf';
export const GUIDE_EDITION = 'Edition 01 · 2026';
export const GUIDE_READ_TIME = '8 min read';
export const GUIDE_SUPPORT_EMAIL = 'support@mhomho.work';

export const GUIDE_STATS = [
  { value: '$1.00', label: 'base CPM per 1,000 verified views' },
  { value: '500', label: 'verified views to pass Campaign Zero' },
  { value: '15', label: 'days to complete Campaign Zero' },
  { value: '1,000', label: 'verified views per paid clip, unless the brief says otherwise' },
] as const;

export type GuideBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'cards'; items: { title: string; body: string; tag?: string }[] }
  | { type: 'steps'; items: { title: string; body: string }[] }
  | { type: 'checklist'; do: string[]; dont: string[] }
  | { type: 'table'; headers: [string, string]; rows: [string, string][] }
  | { type: 'faq'; items: { q: string; a: string }[] }
  | { type: 'hooks'; items: string[] }
  | { type: 'note'; label: string; text: string };

export interface GuideSection {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  intro?: string;
  blocks: GuideBlock[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'deal',
    number: '01',
    eyebrow: 'The deal',
    title: 'The deal, in plain language.',
    intro:
      'You make content. Brands need distribution. Mhomho connects both — and pays creators for the verified views their posts deliver.',
    blocks: [
      {
        type: 'paragraph',
        text:
          'Mhomho is a creator-powered distribution network for brands across Africa. You post content you would make anyway, submit the link, and get paid for verified views. No follower minimum. No gatekeeping. A new account with one qualifying clip earns the same base rate as a page with 100,000 followers.',
      },
      {
        type: 'cards',
        items: [
          {
            tag: 'For creators',
            title: 'Get paid to post content.',
            body:
              'Base rate is $1.00 CPM. Pick a brief, make it yours, submit the live link, and let an admin verify the views.',
          },
          {
            tag: 'For brands',
            title: 'Put a product in many feeds.',
            body:
              'One brief, many creators, one campaign window. Brands get distribution across audiences they do not own.',
          },
        ],
      },
      {
        type: 'note',
        label: 'The number to remember',
        text:
          'Base rate is $1.00 per 1,000 verified views. Campaign-specific CPMs and qualifying thresholds can differ, and are always shown in the brief before you post.',
      },
    ],
  },
  {
    id: 'zero',
    number: '02',
    eyebrow: 'Start here',
    title: 'Campaign Zero, your entry clip.',
    intro:
      'Campaign Zero is the final step before approval. It proves you can make a clip people watch.',
    blocks: [
      {
        type: 'steps',
        items: [
          {
            title: 'Create your creator account',
            body: 'Name, email, handle and password. It takes about two minutes.',
          },
          {
            title: 'Download your clip',
            body:
              'We give you three vertical Mhomho clips and a brand card in the creator app. Add your own voice and captions, then post it from the account you applied with.',
          },
          {
            title: 'Follow a Mhomho social page',
            body: 'Follow any official Mhomho page so we can confirm you are in the network.',
          },
          {
            title: 'Post at least 1 clip featuring Mhomho',
            body:
              'Up to 3 clips are allowed; extras are optional. Keep every post public and live. Use our clip as a cutaway or stitch our post — your clip, your hook, your words.',
          },
          {
            title: 'Reach 500 verified views',
            body:
              'Submit the link in your account. An admin verifies the view count. One clip at 500+ verified views unlocks your dashboard.',
          },
        ],
      },
      {
        type: 'note',
        label: '15-day window',
        text:
          'You have 15 days from sign-up to complete Campaign Zero. If the window expires, start a new one and try again.',
      },
      {
        type: 'note',
        label: 'Real views only',
        text:
          'No bought views. No engagement pods. No reposted or private clips. The views must be real and visible on the public post.',
      },
    ],
  },
  {
    id: 'clip',
    number: '03',
    eyebrow: 'Make it travel',
    title: 'The clip blueprint.',
    intro:
      'Mhomho does not need polished ads. It needs clips that feel native to the feed and make one idea impossible to scroll past.',
    blocks: [
      {
        type: 'cards',
        items: [
          {
            title: 'Hook in the first 2 seconds',
            body:
              'Show the product, the problem or the result immediately. Do not warm up. The first frame is the audition.',
          },
          {
            title: 'Film for the platform',
            body:
              'Vertical 9:16. Caption on screen. Watchable with sound off. Keep the product visible and in use.',
          },
          {
            title: 'Use your voice',
            body:
              'Local language, your face, your humour. The brief is the boundary, not a script to read word for word.',
          },
          {
            title: 'Make one idea obvious',
            body:
              'One product, one problem, one reason to keep watching. Do not cram the whole brief into 15 seconds.',
          },
        ],
      },
      {
        type: 'hooks',
        items: [
          'POV: you finally found a ...',
          'I tried ... for 7 days. Here is what changed.',
          'Nobody talks about this part of ...',
          '3 things I wish I knew before buying ...',
          'Watch until the end to see ...',
        ],
      },
      {
        type: 'note',
        label: 'Follow the brief',
        text:
          'Use the campaign hashtag, mention, sound or call to action exactly as the brief says. Creative freedom lives inside the brief, not outside it.',
      },
    ],
  },
  {
    id: 'submit',
    number: '04',
    eyebrow: 'Clean submission',
    title: 'Submit it right the first time.',
    intro:
      'An admin verifies every submission by hand. A clean submission gets through faster.',
    blocks: [
      {
        type: 'checklist',
        do: [
          'Post from the account you applied with.',
          'Keep the post public for at least 30 days.',
          'Paste the direct post link, not a screenshot of the link.',
          'Use the campaign hashtag, mention or sound in the brief.',
          'Submit the link only after the post is live.',
        ],
        dont: [
          'Do not buy views or use engagement pods.',
          'Do not delete or private the post before payout.',
          'Do not submit a link to a private, expired or edited post.',
          'Do not submit the same link twice.',
          'Do not rely on a screenshot instead of the live link. Screenshots are optional.',
        ],
      },
      {
        type: 'note',
        label: 'Links are required',
        text:
          'You submit links only. Screenshots are optional. An admin verifies the views from the live post.',
      },
    ],
  },
  {
    id: 'paid',
    number: '05',
    eyebrow: 'Getting paid',
    title: 'Verification and payout.',
    intro:
      'Every payout is manual and sent directly. There is no wallet balance or withdrawal button inside the app.',
    blocks: [
      {
        type: 'steps',
        items: [
          {
            title: 'You submit the link',
            body: 'The clip appears in your account as submitted.',
          },
          {
            title: 'An admin verifies it',
            body:
              'We check the live post, the campaign requirements and the view count.',
          },
          {
            title: 'The clip is approved',
            body:
              'Only verified views count. Paid campaigns need 1,000+ verified views per clip unless the campaign says otherwise.',
          },
          {
            title: 'Mhomho sends the payout',
            body:
              'Payouts are manual and sent directly. The minimum balance is $5. EcoCash is used in supported markets; the payout method is confirmed with you.',
          },
        ],
      },
      {
        type: 'note',
        label: 'When payouts go out',
        text:
          'Payouts go out after the campaign closes, once the clip has stayed live for the required 30 days. The app does not process withdrawals.',
      },
      {
        type: 'table',
        headers: ['Counts', 'Does not count'],
        rows: [
          ['Real views on the live public post', 'Bought or bot views'],
          ['Views on the exact submitted link', 'Views on a different repost'],
          ['Views while the post stays live for 30 days', 'Views after the post is deleted or made private'],
        ],
      },
    ],
  },
  {
    id: 'earnings',
    number: '06',
    eyebrow: 'Do the maths',
    title: 'What verified views can earn.',
    intro:
      'The base rate is $1.00 per 1,000 verified views. Use this as a planning estimate, not a promise.',
    blocks: [
      {
        type: 'table',
        headers: ['Verified views', 'Base earnings'],
        rows: [
          ['1,000', '$1.00'],
          ['10,000', '$10.00'],
          ['50,000', '$50.00'],
          ['100,000', '$100.00'],
          ['500,000', '$500.00'],
        ],
      },
      {
        type: 'note',
        label: 'The brief always wins',
        text:
          'Campaign CPM can be higher or different. Paid clips need 1,000+ verified views unless the campaign says otherwise. Only verified views count.',
      },
    ],
  },
  {
    id: 'faq',
    number: '07',
    eyebrow: 'Quick answers',
    title: 'The short answers.',
    intro: 'Still unsure? Email support@mhomho.work and a human will reply.',
    blocks: [
      {
        type: 'faq',
        items: [
          {
            q: 'Do I need followers?',
            a: 'No. There is no follower minimum. A new account with one qualifying clip earns the same base rate as a large page.',
          },
          {
            q: 'Can I submit more than one clip?',
            a: 'Campaign Zero allows up to 3 clips. For paid campaigns, follow the brief; each campaign can set its own limits.',
          },
          {
            q: 'When do I get paid?',
            a: 'After the campaign closes and the clip has stayed live for the required 30 days. Payouts are manual and sent directly. The minimum balance is $5.',
          },
          {
            q: 'Where do payouts go?',
            a: 'EcoCash in supported markets. The payout method is confirmed with you. Do not expect a withdrawal button inside the app.',
          },
          {
            q: 'What if my views are not verified?',
            a: 'Only verified views count. Bought views, private posts, deleted posts and wrong links do not qualify.',
          },
          {
            q: 'Which countries can join?',
            a: 'Brands and creators from other countries can join. Zambia, Tanzania and Mozambique are underway.',
          },
          {
            q: 'Where do I track my clips?',
            a: 'In the Mhomho Android creator app. Download it from mhomho.work, sign in, and follow each submission from posted to verified to paid.',
          },
        ],
      },
    ],
  },
];
