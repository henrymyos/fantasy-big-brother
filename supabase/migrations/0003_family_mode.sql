-- Family mode: one shared league, no accounts.
-- The app is used by a single family for one season, so auth is friction with
-- nothing to protect: anyone who has the app's URL is family. The league is a
-- single well-known row that every client reads/writes anonymously; realtime
-- keeps all devices in sync. This reverses the 0002 auth/ownership model and
-- removes its machinery (the members table held 0 rows).

-- Reopen bb_leagues to anonymous clients.
drop policy if exists "bb_leagues member read" on public.bb_leagues;
drop policy if exists "bb_leagues owner insert" on public.bb_leagues;
drop policy if exists "bb_leagues member update" on public.bb_leagues;
drop policy if exists "bb_leagues owner delete" on public.bb_leagues;
create policy "bb_leagues open read" on public.bb_leagues
  for select to anon, authenticated using (true);
create policy "bb_leagues open insert" on public.bb_leagues
  for insert to anon, authenticated with check (true);
create policy "bb_leagues open update" on public.bb_leagues
  for update to anon, authenticated using (true) with check (true);
grant select, insert, update on public.bb_leagues to anon, authenticated;

-- owner_id is meaningless without accounts (auth.uid() is null for anon).
alter table public.bb_leagues alter column owner_id drop default;

-- Drop the membership machinery from 0002 (table held 0 rows).
-- Table first: its policies depend on bb_is_member().
drop trigger if exists bb_leagues_owner_member on public.bb_leagues;
drop table if exists public.bb_league_members;
drop function if exists public.bb_add_owner_membership();
drop function if exists public.bb_is_member(uuid);
