/**
 * Server-rendered public journal.
 *
 * Google receives finished HTML with title, description, canonical, Open Graph
 * and BlogPosting structured data. No client JavaScript is required to read an
 * article, and the SPA bundle is never loaded on these routes.
 */
import type { Env } from './env.ts';

type Row = Record<string, unknown>;

const BLOG_CSP =
  "default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/blog', priority: '0.9', changefreq: 'daily' },
  { path: '/creator-guide', priority: '0.8', changefreq: 'monthly' },
  { path: '/resources', priority: '0.7', changefreq: 'monthly' },
  { path: '/ambassadors/apply', priority: '0.8', changefreq: 'monthly' },
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function renderInline(raw: string): string {
  let text = escapeHtml(raw);
  const tokens: string[] = [];
  const stash = (html: string) => `\u0000${tokens.push(html) - 1}\u0000`;

  text = text.replace(/`([^`]+)`/g, (_match, code) => stash(`<code>${code}</code>`));

  text = text.replace(
    /!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_match, alt, href) => {
      const url = safeUrl(String(href));
      if (!url) return escapeHtml(String(alt));
      return stash(
        `<img src="${escapeHtml(url)}" alt="${escapeHtml(String(alt))}" loading="lazy" />`
      );
    }
  );

  text = text.replace(
    /\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_match, label, href) => {
      const url = safeUrl(String(href));
      if (!url) return escapeHtml(String(label));
      return stash(`<a href="${escapeHtml(url)}">${label}</a>`);
    }
  );

  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  return text.replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)] ?? '');
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item) => `<li>${renderInline(item)}</li>`).join('');
    out.push(`<${list.type}>${items}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    out.push(`<blockquote><p>${renderInline(quote.join(' '))}</p></blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');

    if (code) {
      if (/^```/.test(line.trim())) {
        out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.push(rawLine);
      }
      continue;
    }

    if (/^```/.test(line.trim())) {
      flushAll();
      code = [];
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(3, heading[1].length);
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushAll();
      out.push('<hr />');
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }
    flushQuote();

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered ?? ordered)![1]);
      continue;
    }
    flushList();

    paragraph.push(line.trim());
  }

  if (code) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  flushAll();
  return out.join('\n');
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function siteUrl(env: Env, path: string): string {
  return `${env.APP_ORIGIN.replace(/\/+$/, '')}${path}`;
}

function pageShell(options: {
  title: string;
  description: string;
  canonical: string;
  body: string;
  ogType: 'website' | 'article';
  image?: string | null;
  jsonLd?: Record<string, unknown> | null;
  noindex?: boolean;
}): string {
  const title = escapeHtml(options.title);
  const description = escapeHtml(options.description);
  const canonical = escapeHtml(options.canonical);
  const image = options.image ? escapeHtml(options.image) : '';
  const robots = options.noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1';
  const jsonLd = options.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(options.jsonLd).replace(
        /</g,
        '\\u003c'
      )}</script>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" type="application/rss+xml" title="MHOMHO Blog RSS" href="/rss.xml" />
<meta property="og:site_name" content="MHOMHO" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:type" content="${options.ogType}" />
<meta property="og:url" content="${canonical}" />
${image ? `<meta property="og:image" content="${image}" />` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
${image ? `<meta name="twitter:image" content="${image}" />` : ''}
<meta name="theme-color" content="#080706" />
<link rel="icon" type="image/svg+xml" sizes="any" href="/icon.svg?v=2" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
${jsonLd}
<style>
:root{--page:#080706;--text:#f6f1e8;--muted:#a39c91;--faint:#6f685f;--line:rgba(246,241,232,.12);--a1:#ffcf3f;--a2:#ff9f0a;--a3:#ff6b4a}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--page);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:820px;margin:0 auto;padding:0 20px}
.nav{position:sticky;top:0;z-index:10;background:rgba(8,7,6,.88);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.nav-inner{max-width:1100px;margin:0 auto;padding:0 20px;height:64px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{font-weight:800;letter-spacing:.14em;font-size:14px;text-decoration:none;background:linear-gradient(100deg,var(--a1),var(--a2),var(--a3));-webkit-background-clip:text;background-clip:text;color:transparent}
.nav-links{display:flex;gap:18px;font-size:13px;color:var(--muted)}
.nav-links a{text-decoration:none}
.nav-links a:hover{color:var(--text)}
.hero{padding:72px 0 34px}
.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--a2);font-weight:800}
h1{font-size:clamp(34px,6vw,54px);line-height:1.04;letter-spacing:-.04em;margin:14px 0 0;font-weight:800}
.lede{font-size:17px;color:var(--muted);max-width:62ch;margin:18px 0 0}
.grid{display:grid;gap:18px;padding:22px 0 64px}
.card{display:block;border:1px solid var(--line);border-radius:20px;padding:22px;text-decoration:none;background:rgba(255,255,255,.025);transition:border-color .15s,transform .15s}
.card:hover{border-color:rgba(255,207,63,.4);transform:translateY(-2px)}
.card h2{font-size:22px;line-height:1.2;margin:0;letter-spacing:-.02em}
.card p{color:var(--muted);font-size:14px;margin:10px 0 0}
.meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:11.5px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-top:16px}
.tag{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:3px 9px;font-size:10.5px;color:var(--muted);text-transform:none;letter-spacing:0}
.cover{width:100%;border-radius:20px;margin:30px 0 0;display:block;border:1px solid var(--line)}
article.prose{font-size:16.5px;margin-top:32px}
.prose h1,.prose h2,.prose h3{line-height:1.2;letter-spacing:-.02em;margin:36px 0 12px}
.prose h1{font-size:32px}.prose h2{font-size:26px}.prose h3{font-size:21px}
.prose p{margin:0 0 18px;color:#ded7cc}
.prose a{color:var(--a1);text-decoration:underline;text-underline-offset:3px}
.prose ul,.prose ol{margin:0 0 18px;padding-left:24px;color:#ded7cc}
.prose li{margin:0 0 8px}
.prose blockquote{margin:22px 0;padding:2px 18px;border-left:3px solid var(--a2);color:var(--muted)}
.prose code{background:rgba(255,255,255,.07);padding:1px 5px;border-radius:5px;font-size:.9em}
.prose pre{background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:12px;padding:16px;overflow:auto}
.prose pre code{background:none;padding:0}
.prose img{max-width:100%;border-radius:14px}
.prose hr{border:0;border-top:1px solid var(--line);margin:30px 0}
.cta{margin:44px 0 0;padding:26px;border:1px solid rgba(255,207,63,.3);border-radius:20px;background:linear-gradient(135deg,rgba(255,207,63,.09),rgba(255,59,59,.05))}
.cta h2{margin:0;font-size:22px}
.cta p{color:var(--muted);font-size:14px;margin:10px 0 0}
.btn{display:inline-flex;margin-top:16px;background:linear-gradient(100deg,var(--a1),var(--a2),var(--a3));color:#1a1204;padding:11px 18px;border-radius:999px;font-weight:800;font-size:13px;text-decoration:none}
footer{border-top:1px solid var(--line);padding:30px 0 48px;color:var(--faint);font-size:12px}
.footer-inner{max-width:1100px;margin:0 auto;padding:0 20px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
@media(max-width:640px){.nav-links{gap:12px;font-size:12px}.hero{padding:48px 0 26px}}
</style>
</head>
<body>
<header class="nav">
  <div class="nav-inner">
    <a class="brand" href="/">MHOMHO</a>
    <nav class="nav-links" aria-label="Main">
      <a href="/">Home</a>
      <a href="/blog">Blog</a>
      <a href="/resources">Resources</a>
      <a href="/ambassadors/apply">Commercial Envoy</a>
    </nav>
  </div>
</header>
<main class="wrap">${options.body}</main>
<footer>
  <div class="footer-inner">
    <span>© ${new Date().getUTCFullYear()} MHOMHO Media</span>
    <span><a href="/blog">Blog</a> · <a href="/resources">Resources</a> · <a href="/ambassadors/apply">Commercial Envoy</a></span>
  </div>
</footer>
</body>
</html>`;
}

function responseHeaders(cacheControl: string, contentType: string): HeadersInit {
  return {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000',
    'Content-Security-Policy': BLOG_CSP,
  };
}

function html(htmlBody: string, status: number, cacheControl: string): Response {
  return new Response(htmlBody, {
    status,
    headers: responseHeaders(cacheControl, 'text/html; charset=utf-8'),
  });
}

const POST_COLUMNS =
  'id, slug, title, excerpt, body_md, cover_image_url, tags, seo_title, seo_description, status, published_at, created_at, updated_at';

export async function serveBlogIndex(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT ${POST_COLUMNS} FROM blog_posts
      WHERE status = 'published' AND published_at IS NOT NULL
      ORDER BY published_at DESC LIMIT 60`
  ).all<Row>();

  const posts = rows.results ?? [];
  const cards = posts
    .map((row) => {
      const slug = str(row.slug);
      const tags = parseTags(row.tags);
      const publishedAt = num(row.published_at);
      return `<a class="card" href="/blog/${encodeURIComponent(slug)}">
  <h2>${escapeHtml(str(row.title))}</h2>
  <p>${escapeHtml(str(row.excerpt))}</p>
  <div class="meta"><span>${formatDate(publishedAt)}</span><span>${readingMinutes(
        str(row.body_md)
      )} min read</span>${tags
        .slice(0, 3)
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join('')}</div>
</a>`;
    })
    .join('\n');

  const canonical = siteUrl(env, '/blog');
  const body = `<section class="hero">
  <p class="eyebrow">MHOMHO Blog</p>
  <h1>Ideas for the people who move crowds.</h1>
  <p class="lede">Playbooks, case notes and straight talk on creator marketing, brand distribution and earning from content across Africa.</p>
</section>
<section class="grid">
  ${
    cards ||
    `<div class="card"><h2>The first article is coming.</h2><p>We’re writing the playbooks we wish existed when we started. Check back soon.</p></div>`
  }
</section>`;

  return html(
    pageShell({
      title: 'MHOMHO Blog — creator marketing and brand distribution in Africa',
      description:
        'Playbooks, case notes and practical advice on creator marketing, brand campaigns and earning from content across Zimbabwe and Africa.',
      canonical,
      body,
      ogType: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'MHOMHO Blog',
        url: canonical,
        description:
          'Playbooks, case notes and practical advice on creator marketing and brand distribution across Africa.',
        publisher: {
          '@type': 'Organization',
          name: 'MHOMHO Media',
          url: siteUrl(env, '/'),
        },
      },
    }),
    200,
    'public, max-age=60, s-maxage=300'
  );
}

export async function serveBlogPost(env: Env, slug: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT ${POST_COLUMNS} FROM blog_posts
      WHERE slug = ? AND status = 'published' AND published_at IS NOT NULL`
  )
    .bind(slug)
    .first<Row>();

  if (!row) {
    const body = `<section class="hero">
  <p class="eyebrow">404</p>
  <h1>That article isn’t here.</h1>
  <p class="lede">It may have moved, or it hasn’t been published yet.</p>
  <p style="margin-top:24px"><a class="btn" href="/blog">Back to the Blog</a></p>
</section>`;
    return html(
      pageShell({
        title: 'Article not found — MHOMHO Blog',
        description: 'This article could not be found.',
        canonical: siteUrl(env, '/blog'),
        body,
        ogType: 'website',
        noindex: true,
      }),
      404,
      'no-store'
    );
  }

  const postSlug = str(row.slug);
  const title = str(row.title);
  const excerpt = str(row.excerpt);
  const bodyMd = str(row.body_md);
  const seoTitle = str(row.seo_title) || `${title} — MHOMHO Blog`;
  const seoDescription = str(row.seo_description) || excerpt;
  const cover = str(row.cover_image_url) || null;
  const coverUrl = cover ? safeUrl(cover) : null;
  const tags = parseTags(row.tags);
  const publishedAt = num(row.published_at);
  const updatedAt = num(row.updated_at) || publishedAt;
  const canonical = siteUrl(env, `/blog/${encodeURIComponent(postSlug)}`);

  const body = `<article>
  <header class="hero">
    <p class="eyebrow"><a href="/blog" style="color:inherit;text-decoration:none">Blog</a> / ${escapeHtml(
      tags[0] ?? 'Article'
    )}</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="lede">${escapeHtml(excerpt)}</p>
    <div class="meta"><span>${formatDate(publishedAt)}</span><span>${readingMinutes(
      bodyMd
    )} min read</span>${tags
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join('')}</div>
    ${
      coverUrl
        ? `<img class="cover" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" />`
        : ''
    }
  </header>
  <div class="prose">${renderMarkdown(bodyMd)}</div>
  <aside class="cta">
    <h2>Put your brand in front of the crowd.</h2>
    <p>MHOMHO connects brands with creators who already have attention. Join the brand waitlist or start earning from your content.</p>
    <a class="btn" href="/">Explore MHOMHO</a>
  </aside>
</article>`;

  return html(
    pageShell({
      title: seoTitle,
      description: seoDescription,
      canonical,
      body,
      ogType: 'article',
      image: coverUrl,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        description: seoDescription,
        datePublished: new Date(publishedAt).toISOString(),
        dateModified: new Date(updatedAt).toISOString(),
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        author: { '@type': 'Organization', name: 'MHOMHO Media', url: siteUrl(env, '/') },
        publisher: {
          '@type': 'Organization',
          name: 'MHOMHO Media',
          url: siteUrl(env, '/'),
          logo: {
            '@type': 'ImageObject',
            url: siteUrl(env, '/icon-512.png?v=2'),
          },
        },
        ...(coverUrl ? { image: [coverUrl] } : {}),
        ...(tags.length > 0 ? { keywords: tags.join(', ') } : {}),
      },
    }),
    200,
    'public, max-age=60, s-maxage=300'
  );
}

export async function serveSitemap(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT slug, published_at, updated_at FROM blog_posts
      WHERE status = 'published' AND published_at IS NOT NULL
      ORDER BY published_at DESC LIMIT 500`
  ).all<Row>();

  const staticUrls = STATIC_PAGES.map(
    (page) => `  <url>
    <loc>${escapeHtml(siteUrl(env, page.path))}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  ).join('\n');

  const postUrls = (rows.results ?? [])
    .map((row) => {
      const lastmod = new Date(num(row.updated_at) || num(row.published_at))
        .toISOString()
        .slice(0, 10);
      return `  <url>
    <loc>${escapeHtml(siteUrl(env, `/blog/${encodeURIComponent(str(row.slug))}`))}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${postUrls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function serveRobots(env: Env): Response {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /console/

Sitemap: ${siteUrl(env, '/sitemap.xml')}
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function serveRss(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT slug, title, excerpt, published_at FROM blog_posts
      WHERE status = 'published' AND published_at IS NOT NULL
      ORDER BY published_at DESC LIMIT 30`
  ).all<Row>();

  const items = (rows.results ?? [])
    .map((row) => {
      const link = siteUrl(env, `/blog/${encodeURIComponent(str(row.slug))}`);
      return `    <item>
      <title>${escapeHtml(str(row.title))}</title>
      <link>${escapeHtml(link)}</link>
      <guid isPermaLink="true">${escapeHtml(link)}</guid>
      <description>${escapeHtml(str(row.excerpt))}</description>
      <pubDate>${new Date(num(row.published_at)).toUTCString()}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MHOMHO Blog</title>
    <link>${escapeHtml(siteUrl(env, '/blog'))}</link>
    <description>Creator marketing and brand distribution across Africa.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
