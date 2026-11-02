-- Run once in Supabase: SQL Editor > New query > paste > Run
create table public.skill_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.skill_state enable row level security;
create policy "read own" on public.skill_state for select using (auth.uid() = user_id);
create policy "insert own" on public.skill_state for insert with check (auth.uid() = user_id);
create policy "update own" on public.skill_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.skill_state for delete using (auth.uid() = user_id);
