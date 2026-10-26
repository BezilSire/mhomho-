/**
 * Social post URL validation and canonicalisation.
 *
 * MHOMHO never fetches a creator-supplied URL. We only parse it, enforce an
 * explicit platform allowlist over HTTPS, and derive a stable identity so the
 * same post cannot be submitted twice. This avoids SSRF entirely: no outbound
 * request is ever made to an attacker-controlled host.
 */

export const SOCIAL_HOSTS = [
  'tiktok.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'fb.watch',
] as const;

export type SocialPlatform = 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';

/** Query parameters that never change which post is being referenced. */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'igshid',
  'igsh',
  'si',
  'feature',
  'ref',
  'ref_src',
  'ref_url',
  'mibextid',
  'share_id',
]);

export interface ParsedSocialUrl {
  canonicalUrl: string;
  identity: string;
  platform: SocialPlatform;
  postId: string | null;
}

export class UrlValidationError extends Error {}

export function isAllowedSocialUrl(value: string): boolean {
  try {
    parseSocialUrl(value);
    return true;
  } catch {
    return false;
  }
}

export function parseSocialUrl(value: string): ParsedSocialUrl {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 2048) throw new UrlValidationError('Enter a valid post link.');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlValidationError('Enter a valid post link.');
  }

  if (url.protocol !== 'https:') {
    throw new UrlValidationError('Post links must start with https://');
  }
  if (url.username || url.password) {
    throw new UrlValidationError('Post links cannot contain credentials.');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const allowed = SOCIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!allowed) {
    throw new UrlValidationError(
      'Use a public TikTok, Instagram, YouTube or Facebook post link.'
    );
  }

  const platform = platformForHost(host);
  const postId = extractPostId(platform, url, host);

  const params = new URLSearchParams();
  for (const [key, val] of url.searchParams.entries()) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) continue;
    params.append(key, val);
  }
  params.sort();

  const path = url.pathname.replace(/\/+$/, '');
  const query = params.toString();
  const canonicalUrl = `https://${host}${path}${query ? `?${query}` : ''}`;

  const identity = postId ? `${platform.toLowerCase()}:${postId}` : `url:${canonicalUrl}`;

  return { canonicalUrl, identity, platform, postId };
}

function platformForHost(host: string): SocialPlatform {
  if (host.endsWith('tiktok.com')) return 'TikTok';
  if (host.endsWith('instagram.com')) return 'Instagram';
  if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) return 'YouTube';
  return 'Facebook';
}

function extractPostId(platform: SocialPlatform, url: URL, host: string): string | null {
  const path = url.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);

  if (platform === 'TikTok') {
    // /@handle/video/1234567890
    const index = parts.indexOf('video');
    return index >= 0 && parts[index + 1] ? onlyDigits(parts[index + 1]) : null;
  }

  if (platform === 'Instagram') {
    // /p/CODE, /reel/CODE, /tv/CODE
    const index = parts.findIndex((part) => part === 'p' || part === 'reel' || part === 'tv');
    return index >= 0 && parts[index + 1] ? safeSegment(parts[index + 1]) : null;
  }

  if (platform === 'YouTube') {
    if (host === 'youtu.be') return safeSegment(parts[0] ?? '');
    const v = url.searchParams.get('v');
    if (v) return safeSegment(v);
    const index = parts.findIndex((part) => part === 'shorts' || part === 'embed' || part === 'live');
    return index >= 0 && parts[index + 1] ? safeSegment(parts[index + 1]) : null;
  }

  // Facebook
  const v = url.searchParams.get('v');
  if (v) return safeSegment(v);
  if (url.hostname === 'fb.watch') return safeSegment(parts[0] ?? '');
  const index = parts.findIndex((part) => part === 'videos' || part === 'reel' || part === 'reels');
  return index >= 0 && parts[index + 1] ? safeSegment(parts[index + 1]) : null;
}

function onlyDigits(value: string): string | null {
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length >= 5 ? cleaned.slice(0, 40) : null;
}

function safeSegment(value: string): string | null {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(value)) return null;
  return value;
}
