-- Run this once against a new Cloudflare D1 database.
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_events_created_at_idx ON activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_session_idx ON activity_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_event_idx ON activity_events(event, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  surname TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  choice TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  fingerprint_hash TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id, created_at DESC);
