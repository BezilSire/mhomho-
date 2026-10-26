import type { Env } from './env.ts';
import { newId } from './auth.ts';

/**
 * Hourly maintenance. Every transition is guarded and auditable, and a campaign
 * is never completed while submissions are still awaiting review.
 */
export async function runScheduled(env: Env, now = Date.now()): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ? OR revoked_at IS NOT NULL`).bind(
      now - 7 * 86_400_000
    ),
    env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).bind(
      Math.floor(now / 1000) - 86_400
    ),
    env.DB.prepare(`DELETE FROM idempotency_keys WHERE expires_at < ?`).bind(now),
  ]);

  await transition(env, 'scheduled', 'live', 'starts_at IS NOT NULL AND starts_at <= ?', now);
  await transition(
    env,
    'live',
    'closing',
    'submission_cutoff_at IS NOT NULL AND submission_cutoff_at <= ?',
    now
  );

  const ready = await env.DB.prepare(
    `SELECT c.id FROM campaigns c
      WHERE c.status = 'closing'
        AND c.views_cutoff_at IS NOT NULL
        AND c.views_cutoff_at <= ?
        AND NOT EXISTS (
          SELECT 1 FROM submissions s
           WHERE s.campaign_id = c.id AND s.status = 'submitted'
        )
      LIMIT 100`
  )
    .bind(now)
    .all<{ id: string }>();

  for (const row of ready.results ?? []) {
    await env.DB.prepare(
      `UPDATE campaigns SET status = 'completed', settled_at = ?, updated_at = ?
        WHERE id = ? AND status = 'closing'`
    )
      .bind(now, now, row.id)
      .run();
    await env.DB.prepare(
      `INSERT INTO audit_events
         (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json,
          request_id, ip_hash, created_at)
       VALUES (?, NULL, NULL, 'campaign.auto_complete', 'campaign', ?, ?, ?, NULL, NULL, ?)`
    )
      .bind(
        newId('audit'),
        row.id,
        JSON.stringify({ status: 'closing' }),
        JSON.stringify({ status: 'completed' }),
        now
      )
      .run();
  }
}

async function transition(
  env: Env,
  from: string,
  to: string,
  condition: string,
  now: number
): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT id FROM campaigns WHERE status = ? AND ${condition} LIMIT 100`
  )
    .bind(from, now)
    .all<{ id: string }>();

  for (const row of rows.results ?? []) {
    await env.DB.prepare(
      `UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ? AND status = ?`
    )
      .bind(to, now, row.id, from)
      .run();
    await env.DB.prepare(
      `INSERT INTO audit_events
         (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json,
          request_id, ip_hash, created_at)
       VALUES (?, NULL, NULL, 'campaign.auto_transition', 'campaign', ?, ?, ?, NULL, NULL, ?)`
    )
      .bind(
        newId('audit'),
        row.id,
        JSON.stringify({ status: from }),
        JSON.stringify({ status: to }),
        now
      )
      .run();
  }
}
