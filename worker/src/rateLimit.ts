import type { Env } from './env.ts';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiting backed by D1.
 *
 * D1 serialises writes per database, so the UPSERT is atomic. This is
 * deliberately simple: it protects authentication and financial endpoints from
 * brute force and accidental loops without an extra paid service.
 */
export async function consumeRateLimit(
  env: Env,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % windowSeconds);
  const retryAfterSeconds = Math.max(1, windowStart + windowSeconds - nowSeconds);

  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, window_start, count)
     VALUES (?, ?, 1)
     ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1
     RETURNING count`
  )
    .bind(bucket, windowStart)
    .first<{ count: number }>();

  const count = Number(row?.count ?? 1);

  // Clear old windows occasionally (≈1 in 50 calls) to keep the table small.
  if (Math.random() < 0.02) {
    await env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?`)
      .bind(nowSeconds - 86_400)
      .run();
  }

  return {
    allowed: count <= limit,
    count,
    limit,
    retryAfterSeconds,
  };
}

/**
 * Clears every window for a bucket. Used after a successful sign-in so a
 * legitimate user is never locked out by earlier typos.
 */
export async function clearRateLimit(env: Env, bucket: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM rate_limits WHERE bucket = ?`).bind(bucket).run();
}
