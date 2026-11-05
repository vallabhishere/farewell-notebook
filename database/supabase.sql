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

create table if not exists public.admin_rate_limits (
  key text primary key,
  window_started bigint not null,
  hits integer not null
);
alter table public.admin_rate_limits enable row level security;

create or replace function public.consume_admin_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now bigint := floor(extract(epoch from clock_timestamp()));
  v_start bigint := floor(v_now / p_window_seconds) * p_window_seconds;
  v_hits integer;
  v_window bigint;
begin
  insert into public.admin_rate_limits as existing (key, window_started, hits)
  values (p_key, v_start, 1)
  on conflict (key) do update set
    window_started = case when existing.window_started + p_window_seconds > v_now then existing.window_started else excluded.window_started end,
    hits = case when existing.window_started + p_window_seconds > v_now then existing.hits + 1 else 1 end
  returning existing.hits, existing.window_started into v_hits, v_window;
  return query select v_hits <= p_max, greatest(1, (v_window + p_window_seconds - v_now)::integer);
end;
$$;
revoke all on function public.consume_admin_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_admin_rate_limit(text, integer, integer) to service_role;

-- Admin rate limits are managed only by server routes using the service-role key.
-- Keep this table out of the public Data API.

-- The app accesses tables only from its server routes with the service-role key.
-- Deny direct browser access through Supabase's Data API.
alter table public.activity_events enable row level security;
alter table public.messages enable row level security;
