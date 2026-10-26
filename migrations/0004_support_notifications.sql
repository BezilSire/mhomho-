-- MHOMHO — creator support tickets and in-app notifications.
--
-- Additive only. No existing table is altered.
--
-- Support tickets are owned by one account and hold an append-only message
-- thread. Ticket numbers are short human-readable references (MH-XXXXXX) so a
-- creator can quote one on WhatsApp; the internal id remains unguessable.
--
-- Notifications are stored once per broadcast, not fanned out per account.
-- Read state lives in notification_reads, so future sign-ups automatically see
-- earlier broadcasts and "send to all" stays a single insert.

CREATE TABLE support_tickets (
  id              TEXT PRIMARY KEY,
  ticket_number   TEXT NOT NULL UNIQUE,
  account_id      TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  category        TEXT NOT NULL CHECK (category IN ('payments', 'campaigns', 'clips', 'account', 'technical', 'other')),
  subject         TEXT NOT NULL CHECK (length(subject) BETWEEN 3 AND 140),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  closed_at       INTEGER
);

CREATE INDEX idx_support_tickets_owner
  ON support_tickets (account_id, last_message_at DESC);

CREATE INDEX idx_support_tickets_status
  ON support_tickets (status, last_message_at DESC);

CREATE TABLE support_messages (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
  author_id   TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('creator', 'admin')),
  body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at  INTEGER NOT NULL
);

CREATE INDEX idx_support_messages_ticket
  ON support_messages (ticket_id, created_at);

CREATE TABLE notifications (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  body                TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  audience            TEXT NOT NULL CHECK (audience IN ('creators', 'approved_creators', 'applicants', 'account')),
  audience_account_id TEXT REFERENCES accounts (id) ON DELETE CASCADE,
  created_by          TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  created_at          INTEGER NOT NULL
);

CREATE INDEX idx_notifications_created
  ON notifications (created_at DESC);

CREATE INDEX idx_notifications_audience
  ON notifications (audience, created_at DESC);

CREATE TABLE notification_reads (
  account_id      TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
  read_at         INTEGER NOT NULL,
  PRIMARY KEY (account_id, notification_id)
);

CREATE INDEX idx_notification_reads_account
  ON notification_reads (account_id, read_at DESC);
