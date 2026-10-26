import type { Ctx } from '../context.ts';
import type { AccountRow } from '../env.ts';
import { recordAudit } from '../audit.ts';
import { newId, requireAccount } from '../auth.ts';
import { badRequest, conflict, json, notFound, tooMany } from '../http.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { body, guardMutation, hashIp } from './helpers.ts';

/**
 * Creator support tickets.
 *
 * A ticket is owned by exactly one account and carries a short human-readable
 * number. Creators may open tickets before approval (Campaign Zero applicants
 * often need help), admins see and answer every ticket.
 *
 * Every read is ownership-checked: knowing a ticket id is never enough to read
 * another creator's thread.
 */

type Row = Record<string, unknown>;

const CATEGORIES = ['payments', 'campaigns', 'clips', 'account', 'technical', 'other'] as const;
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITIES = ['low', 'normal', 'high'] as const;
const MAX_LIST = 50;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function viewerAccount(ctx: Ctx): AccountRow {
  const { account } = requireAccount(ctx);
  if (account.role !== 'creator' && account.role !== 'admin') {
    throw notFound('Ticket not found.');
  }
  return account;
}

function generateTicketNumber(): string {
  // Avoid visually ambiguous characters (0/O, 1/I/L).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let suffix = '';
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `MH-${suffix}`;
}

function creatorOf(row: Row) {
  return {
    uid: str(row.account_id),
    handle: str(row.handle, ''),
    name: str(row.display_name, ''),
    email: str(row.email, ''),
    platform: str(row.platform, ''),
  };
}

function ticketSummary(row: Row) {
  return {
    id: str(row.id),
    number: str(row.ticket_number),
    subject: str(row.subject),
    category: str(row.category),
    status: str(row.status),
    priority: str(row.priority),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
    lastMessageAt: num(row.last_message_at),
    closedAt: row.closed_at === null ? null : num(row.closed_at),
    creator: creatorOf(row),
  };
}

const TICKET_SELECT = `
  SELECT t.id, t.ticket_number, t.account_id, t.category, t.subject, t.status,
         t.priority, t.created_at, t.updated_at, t.last_message_at, t.closed_at,
         p.handle, p.display_name, p.platform, a.email
    FROM support_tickets t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN creator_profiles p ON p.account_id = t.account_id`;

async function loadTicket(ctx: Ctx, id: string): Promise<Row | null> {
  return ctx.env.DB.prepare(`${TICKET_SELECT} WHERE t.id = ?`).bind(id).first<Row>();
}

/* ------------------------------------------------------------------ */
/* Creator-facing                                                      */
/* ------------------------------------------------------------------ */

export async function handleCreateTicket(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = viewerAccount(ctx);
  if (account.role !== 'creator') throw notFound('Ticket not found.');

  const limit = await consumeRateLimit(ctx.env, `support:create:${account.id}`, 5, 60 * 60);
  if (!limit.allowed) {
    throw tooMany('You have opened several tickets recently. Try again later.', limit.retryAfterSeconds);
  }

  const input = await body<{ category: string; subject: string; message: string }>(ctx, {
    category: { type: 'string', required: true, values: CATEGORIES },
    subject: { type: 'string', required: true, min: 3, max: 140 },
    message: { type: 'string', required: true, min: 3, max: 5000 },
  });

  let ticketNumber = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateTicketNumber();
    const existing = await ctx.env.DB.prepare(
      `SELECT 1 AS found FROM support_tickets WHERE ticket_number = ?`
    )
      .bind(candidate)
      .first<Row>();
    if (!existing) {
      ticketNumber = candidate;
      break;
    }
  }
  if (!ticketNumber) throw tooMany('Could not allocate a ticket number. Try again.', 5);

  const now = Date.now();
  const ticketId = newId('ticket');
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO support_tickets
         (id, ticket_number, account_id, category, subject, status, priority,
          created_at, updated_at, last_message_at, closed_at)
       VALUES (?, ?, ?, ?, ?, 'open', 'normal', ?, ?, ?, NULL)`
    ).bind(ticketId, ticketNumber, account.id, input.category, input.subject, now, now, now),
    ctx.env.DB.prepare(
      `INSERT INTO support_messages (id, ticket_id, author_id, author_role, body, created_at)
       VALUES (?, ?, ?, 'creator', ?, ?)`
    ).bind(newId('msg'), ticketId, account.id, input.message, now),
  ]);

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'support.ticket.create',
    entityType: 'support_ticket',
    entityId: ticketId,
    after: { ticketNumber, category: input.category },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  const row = await loadTicket(ctx, ticketId);
  if (!row) throw notFound('Ticket not found.');

  return json({ ok: true, data: { ticket: ticketSummary(row) } }, 201);
}

export async function handleListTickets(ctx: Ctx): Promise<Response> {
  const account = viewerAccount(ctx);
  const isAdmin = account.role === 'admin';

  const statusParam = ctx.url.searchParams.get('status') ?? '';
  const status = (STATUSES as readonly string[]).includes(statusParam) ? statusParam : '';
  const search = (ctx.url.searchParams.get('q') ?? '').trim().slice(0, 80).toLowerCase();
  const offset = Math.max(0, Math.floor(Number(ctx.url.searchParams.get('offset') ?? '0') || 0));

  const where: string[] = [];
  const binds: unknown[] = [];

  if (!isAdmin) {
    where.push('t.account_id = ?');
    binds.push(account.id);
  }
  if (status) {
    where.push('t.status = ?');
    binds.push(status);
  }
  if (search) {
    where.push(
      `(LOWER(t.ticket_number) LIKE ? OR LOWER(t.subject) LIKE ? OR LOWER(COALESCE(p.handle, '')) LIKE ? OR LOWER(COALESCE(p.display_name, '')) LIKE ?)`
    );
    const like = `%${search}%`;
    binds.push(like, like, like, like);
  }

  const rows = await ctx.env.DB.prepare(
    `${TICKET_SELECT}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.last_message_at DESC
     LIMIT ${MAX_LIST} OFFSET ?`
  )
    .bind(...binds, offset)
    .all<Row>();

  const counts: Record<string, number> = Object.fromEntries(STATUSES.map((value) => [value, 0]));
  if (isAdmin) {
    const countRows = await ctx.env.DB.prepare(
      `SELECT status, COUNT(*) AS total FROM support_tickets GROUP BY status`
    ).all<Row>();
    for (const row of countRows.results ?? []) {
      const key = str(row.status);
      if (key in counts) counts[key] = num(row.total);
    }
  }

  return json({
    ok: true,
    data: {
      tickets: (rows.results ?? []).map(ticketSummary),
      counts,
      nextOffset: offset + (rows.results?.length ?? 0),
    },
  });
}

export async function handleGetTicket(ctx: Ctx): Promise<Response> {
  const account = viewerAccount(ctx);
  const isAdmin = account.role === 'admin';
  const ticket = await loadTicket(ctx, ctx.params.id);
  if (!ticket) throw notFound('Ticket not found.');
  if (!isAdmin && str(ticket.account_id) !== account.id) throw notFound('Ticket not found.');

  const messageRows = await ctx.env.DB.prepare(
    `SELECT m.id, m.author_id, m.author_role, m.body, m.created_at,
            p.display_name, p.handle
       FROM support_messages m
       LEFT JOIN creator_profiles p ON p.account_id = m.author_id
      WHERE m.ticket_id = ?
      ORDER BY m.created_at ASC`
  )
    .bind(ctx.params.id)
    .all<Row>();

  return json({
    ok: true,
    data: {
      ticket: ticketSummary(ticket),
      messages: (messageRows.results ?? []).map((row) => ({
        id: str(row.id),
        body: str(row.body),
        authorRole: str(row.author_role),
        authorName: str(row.display_name, str(row.author_role) === 'admin' ? 'Mhommo Support' : 'Creator'),
        authorHandle: str(row.handle, ''),
        createdAt: num(row.created_at),
      })),
    },
  });
}

export async function handleReplyTicket(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = viewerAccount(ctx);
  const isAdmin = account.role === 'admin';

  const ticket = await ctx.env.DB.prepare(
    `SELECT id, ticket_number, account_id, status FROM support_tickets WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!ticket) throw notFound('Ticket not found.');
  if (!isAdmin && str(ticket.account_id) !== account.id) throw notFound('Ticket not found.');
  if (str(ticket.status) === 'closed' && !isAdmin) {
    throw conflict('This ticket is closed. Open a new ticket if you still need help.');
  }

  const limit = await consumeRateLimit(ctx.env, `support:reply:${account.id}`, 30, 10 * 60);
  if (!limit.allowed) {
    throw tooMany('Too many replies. Try again shortly.', limit.retryAfterSeconds);
  }

  const input = await body<{ message: string }>(ctx, {
    message: { type: 'string', required: true, min: 1, max: 5000 },
  });

  const now = Date.now();
  const nextStatus = isAdmin ? 'in_progress' : 'open';
  const statements = [
    ctx.env.DB.prepare(
      `INSERT INTO support_messages (id, ticket_id, author_id, author_role, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(newId('msg'), ctx.params.id, account.id, isAdmin ? 'admin' : 'creator', input.message, now),
    ctx.env.DB.prepare(
      `UPDATE support_tickets
          SET status = ?, updated_at = ?, last_message_at = ?, closed_at = NULL
        WHERE id = ?`
    ).bind(nextStatus, now, now, ctx.params.id),
  ];

  if (isAdmin) {
    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO notifications (id, title, body, audience, audience_account_id, created_by, created_at)
         VALUES (?, ?, ?, 'account', ?, ?, ?)`
      ).bind(
        newId('note'),
        `Support replied to ${str(ticket.ticket_number)}`,
        input.message.length > 180 ? `${input.message.slice(0, 177)}…` : input.message,
        str(ticket.account_id),
        account.id,
        now
      )
    );
  }

  await ctx.env.DB.batch(statements);

  if (isAdmin) {
    await recordAudit(ctx.env, {
      actorId: account.id,
      actorRole: 'admin',
      action: 'support.ticket.reply',
      entityType: 'support_ticket',
      entityId: ctx.params.id,
      after: { ticketNumber: str(ticket.ticket_number), status: nextStatus },
      requestId: ctx.requestId,
      ipHash: await hashIp(ctx.env, ctx.request),
    });
  }

  return json({ ok: true, data: { status: nextStatus } });
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function handleUpdateTicket(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = viewerAccount(ctx);
  if (account.role !== 'admin') throw notFound('Ticket not found.');

  const input = await body<{ status?: string; priority?: string }>(ctx, {
    status: { type: 'string', values: STATUSES },
    priority: { type: 'string', values: PRIORITIES },
  });
  if (!input.status && !input.priority) {
    throw badRequest('Nothing to update.');
  }

  const ticket = await ctx.env.DB.prepare(
    `SELECT id, ticket_number, account_id, status, priority FROM support_tickets WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!ticket) throw notFound('Ticket not found.');

  const now = Date.now();
  const nextStatus = input.status ?? str(ticket.status);
  const nextPriority = input.priority ?? str(ticket.priority);
  const closing = nextStatus === 'resolved' || nextStatus === 'closed';

  const statements = [
    ctx.env.DB.prepare(
      `UPDATE support_tickets
          SET status = ?, priority = ?, updated_at = ?, closed_at = ?
        WHERE id = ?`
    ).bind(nextStatus, nextPriority, now, closing ? now : null, ctx.params.id),
  ];

  if (input.status && closing && nextStatus !== str(ticket.status)) {
    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO notifications (id, title, body, audience, audience_account_id, created_by, created_at)
         VALUES (?, ?, ?, 'account', ?, ?, ?)`
      ).bind(
        newId('note'),
        `Ticket ${str(ticket.ticket_number)} ${nextStatus === 'resolved' ? 'resolved' : 'closed'}`,
        `Your support ticket "${str(ticket.ticket_number)}" has been marked ${nextStatus.replace('_', ' ')}.`,
        str(ticket.account_id),
        account.id,
        now
      )
    );
  }

  await ctx.env.DB.batch(statements);

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'admin',
    action: 'support.ticket.status',
    entityType: 'support_ticket',
    entityId: ctx.params.id,
    before: { status: str(ticket.status), priority: str(ticket.priority) },
    after: { status: nextStatus, priority: nextPriority },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, data: { status: nextStatus, priority: nextPriority } });
}
