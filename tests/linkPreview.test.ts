import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../worker/src/env.ts';
import { getLinkPreview } from '../worker/src/linkPreview.ts';
import { api, registerCreator } from './helpers.ts';

function fakeEnv(options: { cached?: Record<string, unknown> | null } = {}) {
  const writes: Array<{ sql: string; args: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => options.cached ?? null,
            run: async () => {
              writes.push({ sql, args });
              return { success: true };
            },
          };
        },
      };
    },
  };
  return {
    env: { DB: db, YOUTUBE_API_KEY: 'test-key' } as unknown as Env,
    writes,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('link previews', () => {
  it('maps YouTube oEmbed metadata and API statistics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('youtube.com/oembed')) {
          return new Response(
            JSON.stringify({
              title: 'A video',
              author_name: 'A creator',
              thumbnail_url: 'https://img.example/thumb.jpg',
              provider_name: 'YouTube',
            }),
            { status: 200 }
          );
        }
        if (url.includes('googleapis.com/youtube/v3/videos')) {
          return new Response(
            JSON.stringify({ items: [{ statistics: { viewCount: '12345', likeCount: '678' } }] }),
            { status: 200 }
          );
        }
        return new Response('unexpected', { status: 500 });
      })
    );

    const { env, writes } = fakeEnv();
    const preview = await getLinkPreview(env, 'https://youtu.be/dQw4w9WgXcQ', { force: true });

    expect(preview).toMatchObject({
      platform: 'YouTube',
      title: 'A video',
      author: 'A creator',
      thumbnailUrl: 'https://img.example/thumb.jpg',
      provider: 'YouTube',
      views: 12345,
      likes: 678,
      source: 'youtube_api',
    });
    expect(writes).toHaveLength(1);
  });

  it('returns null when the platform cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));

    const { env } = fakeEnv();
    const preview = await getLinkPreview(env, 'https://www.tiktok.com/@creator/video/1234567890', {
      force: true,
    });

    expect(preview).toBeNull();
  });

  it('returns the API envelope the client expects', async () => {
    const creator = await registerCreator();
    const response = await api('/api/links/preview', {
      body: { url: 'https://www.tiktok.com/@creator/video/1234567890' },
      cookie: creator.cookie,
      csrf: creator.csrf,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: { available: false, preview: null },
    });
  });
});
