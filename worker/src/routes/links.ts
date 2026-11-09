import type { Ctx } from '../context.ts';
import { json, tooMany } from '../http.ts';
import { getLinkPreview } from '../linkPreview.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { body, guardMutation, requireCreator } from './helpers.ts';

/**
 * Best-effort preview for a pasted post URL. Invalid or unreachable links
 * return `available: false` rather than an error, so the form never blocks on a
 * platform being slow.
 */
export async function handleLinkPreview(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireCreator(ctx);

  const limit = await consumeRateLimit(ctx.env, `link-preview:${account.id}`, 30, 60);
  if (!limit.allowed) {
    throw tooMany('Too many link checks. Wait a moment and try again.', limit.retryAfterSeconds);
  }

  const input = await body<{ url: string }>(ctx, {
    url: { type: 'string', required: true, min: 10, max: 2048 },
  });

  try {
    const preview = await getLinkPreview(ctx.env, input.url);
    return json({ ok: true, data: { available: Boolean(preview), preview } });
  } catch {
    return json({ ok: true, data: { available: false, preview: null } });
  }
}
