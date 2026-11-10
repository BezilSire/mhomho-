# MHOMHO Journal

The Journal is the public, server-rendered blog at `https://mhomho.work/blog`.
Articles are written in **Operations → Journal** and stored in `blog_posts`.

## Publishing workflow

1. Open Operations and select **Journal**.
2. Choose **New article**.
3. Fill in the title, excerpt and Markdown body.
4. Add a cover image URL if you have one (must be `https://`).
5. Set the status to **Published** and save.
6. Open `/blog/<slug>` and confirm the page renders.
7. Submit `https://mhomho.work/sitemap.xml` in Google Search Console once; Google
   re-reads it automatically.

The slug is generated from the title unless you enter one. Slugs must be unique.
Drafts are never listed, linked, sitemapped or indexable.

## What is generated automatically

- `/blog` — article index with title, description and canonical.
- `/blog/:slug` — article HTML with canonical, Open Graph, Twitter Card and
  `BlogPosting` JSON-LD.
- `/sitemap.xml` — static pages plus every published article.
- `/robots.txt` — allow public pages, block `/api/` and the operations console,
  and point crawlers at the sitemap.
- `/rss.xml` — the 30 newest published articles.

## Writing for search

- One article should answer one clear question.
- Put the search phrase in the title and in the first paragraph.
- Use `##` and `###` headings to break up the answer.
- Aim for 700–1,500 words where the topic deserves it.
- Link to relevant MHOMHO pages and to reputable external sources.
- Keep the excerpt under 160 characters; it is the default meta description.
- Add a cover image with a descriptive alt text through the Markdown image syntax
  or the cover URL field.

Good starting topics:

- How much should a brand pay creators in Zimbabwe?
- What is creator marketing and how does it work in Africa?
- How to run a TikTok campaign in Harare on a small budget.
- EcoCash payouts for creators: what to expect.
- How brands can measure creator campaigns without vanity metrics.

## Google Search Console

1. Add `mhomho.work` as a **Domain** property in Search Console.
2. Verify through Cloudflare DNS (a TXT record), not a meta tag.
3. Submit `https://mhomho.work/sitemap.xml`.
4. Use **URL Inspection** on a new article to request indexing.
5. Check **Pages** after a week for indexing errors.

Search rankings are not instant. A steady publishing rhythm and links from other
sites matter more than any single technical change.
