/**
 * Link previews for creator submissions.
 *
 * We only ever call the platform's fixed oEmbed/API host — never the URL the
 * creator pasted. `parseSocialUrl` enforces the HTTPS platform allowlist, and
 * the canonical URL is passed as a query parameter. Redirects are refused and
 * every request has a short timeout, so a malicious link cannot turn this into
 * an SSRF primitive.
 *
 * Previews are best-effort: a failure returns `null` and never blocks a
 * submission. View/like counts are only available where the platform exposes
 * them officially (YouTube with an API key).
 */
import type { Env } from './env.ts';
import { parseSocialUrl, type SocialPlatform } from './urls.ts';

export const LINK_PREVIEW_TTL_MS = 60 * 60 * 1000;

export interface LinkPreview {
  platform: SocialPlatform;
  canonicalUrl: string;
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  provider: string | null;
  views: number | null;
  likes: number | null;
  source: 'oembed' | 'youtube_api';
  fetchedAt: number;
}

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function count(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function oembedEndpoint(platform: SocialPlatform, canonicalUrl: string): string {
  const encoded = encodeURIComponent(previewUrl(canonicalUrl));
  switch (platform) {
    case 'TikTok':
      return `https://www.tiktok.com/oembed?url=${encoded}`;
    case 'YouTube':
      return `https://www.youtube.com/oembed?url=${encoded}&format=json`;
    case 'Instagram':
      return `https://graph.facebook.com/v26.0/instagram_oembed?url=${encoded}`;
    case 'Facebook':
      return `https://graph.facebook.com/v26.0/oembed_video?url=${encoded}`;
  }
}

/** Canonical URLs drop `www.`; oEmbed providers expect the public `www.` host. */
function previewUrl(canonicalUrl: string): string {
  const url = new URL(canonicalUrl);
  if (
    url.hostname === 'tiktok.com' ||
    url.hostname === 'instagram.com' ||
    url.hostname === 'youtube.com' ||
    url.hostname === 'facebook.com'
  ) {
    url.hostname = `www.${url.hostname}`;
  }
  return url.toString();
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MhomhoLinkPreview/1.0)',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function fetchOembed(
  platform: SocialPlatform,
  canonicalUrl: string
): Promise<Record<string, unknown> | null> {
  const first = await fetchJson(oembedEndpoint(platform, canonicalUrl));
  if (first) return first;
  // Facebook posts sometimes need the post endpoint rather than the video one.
  if (platform === 'Facebook') {
    return fetchJson(
      `https://graph.facebook.com/v26.0/oembed_post?url=${encodeURIComponent(previewUrl(canonicalUrl))}`
    );
  }
  return null;
}

async function fetchYoutubeStats(
  env: Env,
  postId: string | null
): Promise<{ views: number | null; likes: number | null }> {
  if (!env.YOUTUBE_API_KEY || !postId) return { views: null, likes: null };
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(postId)}` +
    `&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`;
  const data = await fetchJson(url);
  const items = data?.items;
  if (!Array.isArray(items) || items.length === 0) return { views: null, likes: null };
  const statistics = (items[0] as Record<string, unknown>)?.statistics as
    | Record<string, unknown>
    | undefined;
  return {
    views: count(statistics?.viewCount),
    likes: count(statistics?.likeCount),
  };
}

function rowToPreview(row: Row): LinkPreview {
  return {
    platform: String(row.platform) as SocialPlatform,
    canonicalUrl: String(row.url_key),
    title: str(row.title),
    author: str(row.author),
    thumbnailUrl: str(row.thumbnail_url),
    provider: str(row.provider),
    views: count(row.preview_views),
    likes: count(row.preview_likes),
    source: row.source === 'youtube_api' ? 'youtube_api' : 'oembed',
    fetchedAt: Number(row.fetched_at) || 0,
  };
}

async function cachePreview(env: Env, preview: LinkPreview): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO link_previews
       (url_key, platform, title, author, thumbnail_url, provider, preview_views,
        preview_likes, source, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url_key) DO UPDATE SET
       platform = excluded.platform,
       title = excluded.title,
       author = excluded.author,
       thumbnail_url = excluded.thumbnail_url,
       provider = excluded.provider,
       preview_views = excluded.preview_views,
       preview_likes = excluded.preview_likes,
       source = excluded.source,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`
  )
    .bind(
      preview.canonicalUrl,
      preview.platform,
      preview.title,
      preview.author,
      preview.thumbnailUrl,
      preview.provider,
      preview.views,
      preview.likes,
      preview.source,
      preview.fetchedAt,
      now + LINK_PREVIEW_TTL_MS
    )
    .run();
}

export async function getLinkPreview(
  env: Env,
  rawUrl: string,
  options: { force?: boolean } = {}
): Promise<LinkPreview | null> {
  if (env.LINK_PREVIEWS_DISABLED === 'true') return null;
  const parsed = parseSocialUrl(rawUrl);
  const now = Date.now();

  const cached = await env.DB.prepare(`SELECT * FROM link_previews WHERE url_key = ?`)
    .bind(parsed.canonicalUrl)
    .first<Row>();

  if (cached && !options.force && Number(cached.expires_at) > now) {
    return rowToPreview(cached);
  }

  const oembed = await fetchOembed(parsed.platform, parsed.canonicalUrl);
  if (!oembed) {
    // A stale snapshot is still useful evidence; prefer it to nothing.
    return cached ? rowToPreview(cached) : null;
  }

  const youtube = await fetchYoutubeStats(env, parsed.postId);
  const preview: LinkPreview = {
    platform: parsed.platform,
    canonicalUrl: parsed.canonicalUrl,
    title: str(oembed.title),
    author: str(oembed.author_name),
    thumbnailUrl: str(oembed.thumbnail_url),
    provider: str(oembed.provider_name),
    views: youtube.views,
    likes: youtube.likes,
    source: youtube.views !== null || youtube.likes !== null ? 'youtube_api' : 'oembed',
    fetchedAt: now,
  };

  try {
    await cachePreview(env, preview);
  } catch {
    // Cache is an optimisation; a failed write must not break the preview.
  }

  return preview;
}
