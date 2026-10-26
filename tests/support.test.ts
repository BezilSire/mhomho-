/**
 * Support tickets and in-app notifications.
 *
 * The important guarantees: a creator can only ever read their own thread,
 * admins see who opened each ticket, and a broadcast is delivered to the right
 * audience with a working unread count.
 */
import { describe, expect, it } from 'vitest';
import { api, approvedCreator, registerCreator, setupAdmin, unique } from './helpers.ts';

interface TicketBody {
  ticket: {
    id: string;
    number: string;
    subject: string;
    status: string;
    creator: { uid: string; handle: string; name: string; email: string };
  };
}

async function openTicket(
  creator: Awaited<ReturnType<typeof registerCreator>>,
  subject = 'My payout is missing'
) {
  const response = await api('/api/support/tickets', {
    cookie: creator.cookie,
    csrf: creator.csrf,
    body: { category: 'payments', subject, message: 'I requested a payout last week and it has not arrived.' },
  });
  expect(response.status).toBe(201);
  return response.body.data.ticket as TicketBody['ticket'];
}

describe('support tickets', () => {
  it('lets an applicant open a ticket and read their own thread', async () => {
    const creator = await registerCreator({ handle: unique('ticket-owner') });
    const ticket = await openTicket(creator);

    expect(ticket.number).toMatch(/^MH-[A-Z2-9]{6}$/);
    expect(ticket.status).toBe('open');
    expect(ticket.creator.uid).toBe(creator.accountId);

    const list = await api('/api/support/tickets', { cookie: creator.cookie });
    expect(list.status).toBe(200);
    expect(list.body.data.tickets).toHaveLength(1);

    const detail = await api(`/api/support/tickets/${ticket.id}`, { cookie: creator.cookie });
    expect(detail.status).toBe(200);
    expect(detail.body.data.messages).toHaveLength(1);
    expect(detail.body.data.messages[0].body).toContain('payout');
  });

  it('never exposes another creator’s ticket', async () => {
    const owner = await registerCreator({ handle: unique('owner') });
    const stranger = await registerCreator({ handle: unique('stranger') });
    const ticket = await openTicket(owner);

    const otherList = await api('/api/support/tickets', { cookie: stranger.cookie });
    expect(otherList.body.data.tickets).toHaveLength(0);

    const otherDetail = await api(`/api/support/tickets/${ticket.id}`, {
      cookie: stranger.cookie,
    });
    expect(otherDetail.status).toBe(404);

    const otherReply = await api(`/api/support/tickets/${ticket.id}/messages`, {
      cookie: stranger.cookie,
      csrf: stranger.csrf,
      body: { message: 'Trying to hijack this thread.' },
    });
    expect(otherReply.status).toBe(404);
  });

  it('requires authentication to open a ticket', async () => {
    const response = await api('/api/support/tickets', {
      body: { category: 'other', subject: 'No session', message: 'Should not be accepted.' },
    });
    expect(response.status).toBe(401);
  });

  it('shows admins who opened each ticket and lets them reply', async () => {
    const admin = await setupAdmin();
    const handle = unique('needs-help');
    const creator = await registerCreator({ handle });
    const ticket = await openTicket(creator, 'Clip was rejected');

    const list = await api('/api/support/tickets', { cookie: admin.cookie });
    expect(list.status).toBe(200);
    expect(list.body.data.counts.open).toBe(1);
    const row = list.body.data.tickets.find((entry: { id: string }) => entry.id === ticket.id);
    expect(row.creator.handle).toBe(`@${handle}`);
    expect(row.creator.email).toBe(creator.email);

    const reply = await api(`/api/support/tickets/${ticket.id}/messages`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { message: 'We reopened the clip and credited the views.' },
    });
    expect(reply.status).toBe(200);
    expect(reply.body.data.status).toBe('in_progress');

    // The reply lands in the creator's notification bell.
    const notifications = await api('/api/notifications', { cookie: creator.cookie });
    expect(notifications.status).toBe(200);
    expect(notifications.body.data.unread).toBe(1);
    const note = notifications.body.data.items[0];
    expect(note.title).toContain(ticket.number);
    expect(note.body).toContain('credited the views');

    const read = await api(`/api/notifications/${note.id}/read`, {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {},
    });
    expect(read.status).toBe(200);
    const after = await api('/api/notifications', { cookie: creator.cookie });
    expect(after.body.data.unread).toBe(0);
  });

  it('only lets admins change ticket status', async () => {
    const admin = await setupAdmin();
    const creator = await registerCreator({ handle: unique('status-owner') });
    const ticket = await openTicket(creator);

    const denied = await api(`/api/admin/support/tickets/${ticket.id}`, {
      method: 'PATCH',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { status: 'resolved' },
    });
    expect(denied.status).toBe(404);

    const resolved = await api(`/api/admin/support/tickets/${ticket.id}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'resolved', priority: 'high' },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('resolved');
    expect(resolved.body.data.priority).toBe('high');

    // Resolving notifies the owner.
    const notifications = await api('/api/notifications', { cookie: creator.cookie });
    expect(
      notifications.body.data.items.some((item: { title: string }) =>
        item.title.includes(ticket.number)
      )
    ).toBe(true);
  });
});

describe('notifications', () => {
  it('delivers broadcasts to the selected audience only', async () => {
    const admin = await setupAdmin();
    const applicant = await registerCreator({ handle: unique('applicant') });
    const approved = await approvedCreator(admin);

    const broadcast = await api('/api/admin/notifications', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title: 'Payouts run on Friday',
        message: 'EcoCash payouts are processed every Friday afternoon.',
        audience: 'approved_creators',
      },
    });
    expect(broadcast.status).toBe(201);

    const approvedFeed = await api('/api/notifications', { cookie: approved.cookie });
    expect(approvedFeed.body.data.items.map((item: { title: string }) => item.title)).toContain(
      'Payouts run on Friday'
    );

    const applicantFeed = await api('/api/notifications', { cookie: applicant.cookie });
    expect(applicantFeed.body.data.items.map((item: { title: string }) => item.title)).not.toContain(
      'Payouts run on Friday'
    );

    const applicantsOnly = await api('/api/admin/notifications', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title: 'Finish Campaign Zero',
        message: 'Submit your three clips to unlock the dashboard.',
        audience: 'applicants',
      },
    });
    expect(applicantsOnly.status).toBe(201);

    const applicantAfter = await api('/api/notifications', { cookie: applicant.cookie });
    expect(
      applicantAfter.body.data.items.map((item: { title: string }) => item.title)
    ).toContain('Finish Campaign Zero');
  });

  it('targets one creator without leaking to others', async () => {
    const admin = await setupAdmin();
    const target = await registerCreator({ handle: unique('target') });
    const other = await registerCreator({ handle: unique('bystander') });

    const sent = await api('/api/admin/notifications', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title: 'About your latest clip',
        message: 'Send us the original file on WhatsApp.',
        audience: 'account',
        accountId: target.accountId,
      },
    });
    expect(sent.status).toBe(201);

    const targetFeed = await api('/api/notifications', { cookie: target.cookie });
    expect(targetFeed.body.data.unread).toBe(1);

    const otherFeed = await api('/api/notifications', { cookie: other.cookie });
    expect(otherFeed.body.data.unread).toBe(0);
    expect(otherFeed.body.data.items).toHaveLength(0);
  });

  it('marks every visible notification as read', async () => {
    const admin = await setupAdmin();
    const creator = await registerCreator({ handle: unique('read-all') });

    for (const title of ['First', 'Second']) {
      const response = await api('/api/admin/notifications', {
        cookie: admin.cookie,
        csrf: admin.csrf,
        body: { title, message: 'Body text.', audience: 'creators' },
      });
      expect(response.status).toBe(201);
    }

    const before = await api('/api/notifications', { cookie: creator.cookie });
    expect(before.body.data.unread).toBe(2);

    const readAll = await api('/api/notifications/read-all', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {},
    });
    expect(readAll.status).toBe(200);

    const after = await api('/api/notifications', { cookie: creator.cookie });
    expect(after.body.data.unread).toBe(0);
  });

  it('rejects broadcasts from non-admin sessions', async () => {
    const creator = await registerCreator({ handle: unique('not-admin') });
    const response = await api('/api/admin/notifications', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { title: 'Fake', message: 'Spam.', audience: 'creators' },
    });
    expect(response.status).toBe(403);
  });
});
