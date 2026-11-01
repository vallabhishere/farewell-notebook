-- Run this once in the SQL editor of a new Supabase project.
create table if not exists public.activity_events (
  id text primary key,
  session_id text not null default '',
  name text not null default '',
  event text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists activity_events_created_at_idx on public.activity_events(created_at desc);
create index if not exists activity_events_session_idx on public.activity_events(session_id, created_at desc);
create index if not exists activity_events_event_idx on public.activity_events(event, created_at desc);

create table if not exists public.messages (
  id text primary key,
  name text not null,
  surname text not null default '',
  kind text not null,
  choice text not null default '',
  contact text not null default '',
  message text not null default '',
  date text not null default '',
  session_id text not null default '',
  fingerprint_hash text not null default '',
  email_status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists messages_created_at_idx on public.messages(created_at desc);
create index if not exists messages_session_idx on public.messages(session_id, created_at desc);

-- The app accesses tables only from its server routes with the service-role key.
-- Deny direct browser access through Supabase's Data API.
alter table public.activity_events enable row level security;
alter table public.messages enable row level security;
