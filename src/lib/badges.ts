/**
 * Listings MHOMHO appears on.
 *
 * Add a badge here and it appears in the floating marquee under the hero.
 * Images are mirrored on our own domain so a listing site that challenges
 * bots cannot leave a gap in the strip.
 */
export interface ListingBadge {
  id: string;
  /** Alt text for the badge. */
  label: string;
  /** Where the badge links to. */
  href: string;
  /** Path of the mirrored image on our own domain. */
  src: string;
  /** Remote image, used if the mirrored copy ever fails to load. */
  fallbackSrc?: string;
  width: number;
  height: number;
}

export const LISTING_BADGES: ListingBadge[] = [
  {
    id: 'african-startup-magazine',
    label: 'Featured on African Startup Magazine',
    href: 'https://africastartupmagazine.com/startup/1f672ac9-c0fc-4148-8383-2c1244936984',
    src: '/badges/african-startup-magazine.jpg',
    width: 800,
    height: 184,
  },
  {
    id: 'au-startups',
    label: 'Listed on AU Startups',
    href: 'https://au-startups.com/startups/mhomho',
    src: '/badges/au-startups-logo-192.png',
    fallbackSrc:
      'https://au-startups.com/_next/image?url=%2Fbrand%2Flogo-320.png&w=192&q=75',
    width: 192,
    height: 43,
  },
  {
    id: 'startuplist-africa',
    label: 'Listed on StartupList Africa',
    href: 'https://www.startuplist.africa/startups/mhomho',
    src: '/badges/listed-on-startuplist-africa-light.png',
    fallbackSrc:
      'https://www.startuplist.africa/badges/listed-on-startuplist-africa-light.png',
    width: 244,
    height: 56,
  },
];
