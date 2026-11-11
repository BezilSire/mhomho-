/**
 * Update these handles if the official pages change. Campaign Zero requires
 * a creator to follow at least one of them before submitting for review.
 *
 * The Facebook entry is a share link to the Mhomho Media page. Swap it for a
 * permanent page URL if the page ever gets a vanity path of its own.
 */
/**
 * Campaign Zero source clips.
 *
 * Vertical 9:16 H.264, no audio, so the creator adds their own voice and
 * trending sound. Served from our own domain, not a third-party drive.
 */
export const MHOMHO_CAMPAIGN_ZERO_CLIPS = [
  {
    id: 'clip-1',
    label: 'Clip 1',
    note: 'No follower minimum',
    file: '/download/mhomho-campaign-zero-1.mp4',
  },
  {
    id: 'clip-2',
    label: 'Clip 2',
    note: 'What Mhomho is',
    file: '/download/mhomho-campaign-zero-2.mp4',
  },
  {
    id: 'clip-3',
    label: 'Clip 3',
    note: 'How you get paid',
    file: '/download/mhomho-campaign-zero-3.mp4',
  },
] as const;

/** Short branded card creators can use as a cutaway or stitch source. */
export const MHOMHO_BRAND_CARD = '/download/mhomho-brand-card.mp4';

export const MHOMHO_SOCIALS = [
  { name: 'TikTok', handle: '@mhomho', url: 'https://www.tiktok.com/@mhomho' },
  { name: 'Instagram', handle: '@mhomho', url: 'https://www.instagram.com/mhomho' },
  {
    name: 'Facebook',
    handle: 'Mhomho Media',
    url: 'https://www.facebook.com/share/1F3bGwL5vU/?mibextid=wwXIfr',
  },
] as const;
