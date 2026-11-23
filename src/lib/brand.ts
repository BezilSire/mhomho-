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
 * Delivered exactly as rendered: H.264 with the original sound intact. The
 * creator mutes it and adds their own voice, or uses it as a cutaway. Served
 * from our own domain, not a third-party drive.
 *
 * The brand video is the raw brand film, vertical, untouched — no re-encode,
 * no captions, no overlays.
 */
export const MHOMHO_CAMPAIGN_ZERO_CLIPS = [
  {
    id: 'clip-1',
    label: 'Clip 1',
    note: 'No follower minimum',
    meta: '16:9 · original sound included',
    file: '/download/mhomho-campaign-zero-1.mp4?v=3',
  },
  {
    id: 'brand-video',
    label: 'Brand video',
    note: 'What Mhomho is',
    meta: '9:16 vertical · original sound included',
    file: '/download/mhomho-brand-video.mp4?v=4',
  },
  {
    id: 'earn-money',
    label: 'Earn money with Mhomho',
    note: 'How you get paid',
    meta: '9:16 vertical · voiceover included',
    file: '/download/mhomho-earn-money.mp4?v=1',
  },
] as const;

export const MHOMHO_SOCIALS = [
  { name: 'TikTok', handle: '@mhomho', url: 'https://www.tiktok.com/@mhomho' },
  { name: 'Instagram', handle: '@mhomho', url: 'https://www.instagram.com/mhomho' },
  {
    name: 'Facebook',
    handle: 'Mhomho Media',
    url: 'https://www.facebook.com/share/1F3bGwL5vU/?mibextid=wwXIfr',
  },
] as const;
