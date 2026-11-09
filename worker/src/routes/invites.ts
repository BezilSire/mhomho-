import type { Ctx } from '../context.ts';
import { recordAudit } from '../audit.ts';
import { newId, requireAdmin } from '../auth.ts';
import { conflict, json, notFound } from '../http.ts';
import { INVITE_MODES, type InviteMode } from '../../../shared/invites.ts';
import {
  generateInviteCode,
  getInviteSettings,
  hashInviteCode,
  inviteCodeHint,
  INVITE_CODE_TTL_MS,
} from '../invites.ts';
import { body, guardMutation, hashIp } from './helpers.ts';

type Row = Record<string, unknown>;

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Public gate status for the sign-up form. Exposes only aggregate numbers, so an
 * anonymous visitor can learn whether an invite code is needed without seeing
 * any creator data.
 */
export async function handleSignupConfig(ctx: Ctx): Promise<Response> {
  const settings = await getInviteSettings(ctx.env);
  return json({ ok: true, data: settings });
}

/** Admin-only invite console: current gate settings and the latest codes. */
export async function handleAdminInvites(ctx: Ctx): Promise<Response> {
  requireAdmin(ctx);

  const settings = await getInviteSettings(ctx.env);
  const rows = await ctx.env.DB.prepare(
    `SELECT id, code_hint, label, created_at, expires_at, used_at, used_by, revoked_at
       FROM invite_codes
      ORDER BY created_at DESC
      LIMIT 100`
  ).all<Row>();

  const now = Date.now();
  return json({
    ok: true,
    data: {
      ...settings,
      codes: (rows.results ?? []).map((row) => {
        const expiresAt = num(row.expires_at);
        const usedAt = row.used_at === null ? null : num(row.used_at);
        const revokedAt = row.revoked_at === null ? null : num(row.revoked_at);
        return {
          id: str(row.id),
          hint: str(row.code_hint),
          label: row.label === null ? null : str(row.label),
          createdAt: num(row.created_at),
          expiresAt,
          usedAt,
          usedBy: row.used_by === null ? null : str(row.used_by),
          revokedAt,
          status: usedAt
            ? 'used'
            : revokedAt
              ? 'revoked'
              : expiresAt <= now
                ? 'expired'
                : 'active',
        };
      }),
    },
  });
}

/**
 * Creates one single-use code. The raw code is returned exactly once; only its
 * hash and a four-character hint are stored, so the list view cannot leak a
 * usable code.
 */
export async function handleCreateInvite(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ label?: string | null }>(ctx, {
    label: { type: 'string', min: 2, max: 120, nullable: true },
  });

  const now = Date.now();
  const rawCode = generateInviteCode();
  const codeHash = await hashInviteCode(rawCode);
  const hint = inviteCodeHint(rawCode);
  const id = newId('inv');
  const expiresAt = now + INVITE_CODE_TTL_MS;
  const label = input.label ?? null;

  await ctx.env.DB.prepare(
    `INSERT INTO invite_codes
       (id, code_hash, code_hint, label, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, codeHash, hint, label, admin.id, now, expiresAt)
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'invite.create',
    entityType: 'invite_code',
    entityId: id,
    after: { hint, label, expiresAt },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json(
    { ok: true, data: { id, code: rawCode, hint, label, expiresAt } },
    201
  );
}

/** Revokes an unused code. Used codes keep their history and cannot be revoked. */
export async function handleRevokeInvite(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const row = await ctx.env.DB.prepare(
    `SELECT id, code_hint, used_at, revoked_at FROM invite_codes WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!row) throw notFound('Invite code not found.');
  if (row.used_at !== null) throw conflict('This invite code has already been used.');

  const now = Date.now();
  if (row.revoked_at === null) {
    await ctx.env.DB.prepare(
      `UPDATE invite_codes SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`
    )
      .bind(now, ctx.params.id)
      .run();

    await recordAudit(ctx.env, {
      actorId: admin.id,
      actorRole: 'admin',
      action: 'invite.revoke',
      entityType: 'invite_code',
      entityId: ctx.params.id,
      after: { hint: str(row.code_hint), revokedAt: now },
      requestId: ctx.requestId,
      ipHash: await hashIp(ctx.env, ctx.request),
    });
  }

  return json({ ok: true });
}

/** Switches the gate between auto (threshold), always on, and open. */
export async function handleInviteMode(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ mode: InviteMode }>(ctx, {
    mode: { type: 'string', required: true, values: INVITE_MODES },
  });

  const now = Date.now();
  await ctx.env.DB.prepare(
    `INSERT INTO app_config (key, value, updated_at)
     VALUES ('creator_invite_mode', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(input.mode, now)
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'invite.mode',
    entityType: 'app_config',
    entityId: 'creator_invite_mode',
    after: { mode: input.mode },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  const settings = await getInviteSettings(ctx.env);
  return json({ ok: true, data: settings });
}
