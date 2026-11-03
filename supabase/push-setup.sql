-- Part A: run once in SQL Editor (table for each device's notification subscription)
create table public.push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz text not null default 'America/Chicago',
  times int[] not null default '{8,12,15,18}',
  enabled boolean not null default true,
  last_slot text,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
create policy "own subs" on public.push_subs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Part B: run AFTER the "notify" Edge Function is deployed (checks every 15 minutes)
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('skilltree-notify', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://vozkyinemhdzdfhpywlj.supabase.co/functions/v1/Notify',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "PASTE_YOUR_CRON_SECRET_HERE"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

-- Part C (side quests): remembers which alerts were sent, and checks every 5 minutes
create table public.side_alerts (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id text not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, quest_id, kind)
);
alter table public.side_alerts enable row level security;
-- (re-run the cron.schedule from Part B with '*/5 * * * *' instead of '*/15 * * * *')
