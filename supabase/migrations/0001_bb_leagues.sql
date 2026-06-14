-- Fantasy Big Brother shared-league storage.
-- Standalone table, prefixed bb_ to coexist with anything else in the project.
-- Each league is one row holding the whole LeagueState as JSON. Leagues are
-- shared by their (unguessable) uuid: anyone with the link can read & edit.
-- Low-stakes family app with no sensitive data, so policies are open and keyed
-- by uuid rather than per-user auth. Swap in Supabase Auth + ownership policies
-- if stricter access control is ever needed.

create table if not exists public.bb_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Big Brother Fantasy League',
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.bb_leagues enable row level security;

create policy "bb_leagues read" on public.bb_leagues
  for select to anon, authenticated using (true);
create policy "bb_leagues insert" on public.bb_leagues
  for insert to anon, authenticated with check (true);
create policy "bb_leagues update" on public.bb_leagues
  for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.bb_leagues to anon, authenticated;

-- Broadcast row changes to subscribed clients (realtime).
alter publication supabase_realtime add table public.bb_leagues;
