import type { Env } from './env.ts';
import { randomId } from './crypto.ts';

export interface AuditInput {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  requestId?: string;
  ipHash?: string | null;
}

/**
 * Append a durable audit record. Called for every administrative or financial
 * mutation. Never include secrets, password material, session tokens or full
 * payout destinations in `before`/`after`.
 */
export async function recordAudit(env: Env, input: AuditInput): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_events
       (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, request_id, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      randomId('audit'),
      input.actorId,
      input.actorRole,
      input.action,
      input.entityType,
      input.entityId,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.requestId ?? null,
      input.ipHash ?? null,
      Date.now()
    )
    .run();
}
