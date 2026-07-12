-- Optimistic locking for the shared league row. Clients save with
-- rev = current + 1 guarded by eq(rev, current); a conflict updates 0 rows
-- and the client rebases. The trigger hard-rejects any writer that doesn't
-- bump rev (i.e. tabs running pre-locking code), so a stale sleeping tab
-- can no longer clobber the family's picks.
alter table public.bb_leagues add column if not exists rev bigint not null default 0;

create or replace function public.bb_enforce_rev()
returns trigger language plpgsql as $$
begin
  if new.rev is distinct from old.rev + 1 then
    raise exception 'bb_leagues: stale write (rev % -> %) — reload the app',
      old.rev, new.rev;
  end if;
  return new;
end $$;

drop trigger if exists bb_leagues_rev on public.bb_leagues;
create trigger bb_leagues_rev before update on public.bb_leagues
  for each row execute function public.bb_enforce_rev();
