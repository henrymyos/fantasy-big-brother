-- Auth + ownership for Fantasy Big Brother shared leagues.
-- Leagues are private to signed-in members; each league has an owner who can
-- delete it and remove members. Email/password auth via Supabase Auth.

-- Owner of each league (defaults to the creating user).
alter table public.bb_leagues
  add column if not exists owner_id uuid references auth.users(id)
    on delete set null default auth.uid();

-- League membership (denormalized email so members can be listed without
-- exposing auth.users to clients).
create table if not exists public.bb_league_members (
  league_id uuid not null references public.bb_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  email text,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
alter table public.bb_league_members enable row level security;

-- Membership check that bypasses RLS to avoid recursive policy evaluation.
create or replace function public.bb_is_member(p_league uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(
    select 1 from public.bb_league_members
    where league_id = p_league and user_id = auth.uid()
  );
$$;
revoke execute on function public.bb_is_member(uuid) from anon, public;
grant execute on function public.bb_is_member(uuid) to authenticated;

-- Auto-add the creator as the owner-member (with their email).
create or replace function public.bb_add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.bb_league_members(league_id, user_id, email, role)
  select new.id, new.owner_id, u.email, 'owner'
  from auth.users u where u.id = new.owner_id
  on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.bb_add_owner_membership() from anon, public, authenticated;
drop trigger if exists bb_leagues_owner_member on public.bb_leagues;
create trigger bb_leagues_owner_member after insert on public.bb_leagues
  for each row execute function public.bb_add_owner_membership();

-- Leagues: members read/update; owner inserts/deletes. The owner predicate is
-- included directly so INSERT ... RETURNING works before the owner-membership
-- trigger row is visible.
drop policy if exists "bb_leagues read" on public.bb_leagues;
drop policy if exists "bb_leagues insert" on public.bb_leagues;
drop policy if exists "bb_leagues update" on public.bb_leagues;
create policy "bb_leagues member read" on public.bb_leagues
  for select to authenticated using (owner_id = auth.uid() or public.bb_is_member(id));
create policy "bb_leagues owner insert" on public.bb_leagues
  for insert to authenticated with check (owner_id = auth.uid());
create policy "bb_leagues member update" on public.bb_leagues
  for update to authenticated
  using (owner_id = auth.uid() or public.bb_is_member(id))
  with check (owner_id = auth.uid() or public.bb_is_member(id));
create policy "bb_leagues owner delete" on public.bb_leagues
  for delete to authenticated using (owner_id = auth.uid());

-- Members: see your own row + co-members; join yourself; leave (or owner removes).
create policy "bb_members read same league" on public.bb_league_members
  for select to authenticated using (user_id = auth.uid() or public.bb_is_member(league_id));
create policy "bb_members join self" on public.bb_league_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "bb_members leave or owner removes" on public.bb_league_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.bb_leagues l where l.id = league_id and l.owner_id = auth.uid())
  );

revoke select, insert, update, delete on public.bb_leagues from anon;
grant select, insert, update, delete on public.bb_leagues to authenticated;
grant select, insert, delete on public.bb_league_members to authenticated;
alter publication supabase_realtime add table public.bb_league_members;