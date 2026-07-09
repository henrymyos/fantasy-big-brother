-- Family league chat: no accounts, author is a self-reported display name.
-- Same trust model as the league itself — anyone with the app URL is family.
create table if not exists public.bb_messages (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.bb_leagues(id) on delete cascade,
  author text not null check (char_length(author) between 1 and 40),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists bb_messages_league_time
  on public.bb_messages (league_id, created_at);
alter table public.bb_messages enable row level security;
create policy "bb_messages open read" on public.bb_messages
  for select to anon, authenticated using (true);
create policy "bb_messages open insert" on public.bb_messages
  for insert to anon, authenticated with check (true);
grant select, insert on public.bb_messages to anon, authenticated;
alter publication supabase_realtime add table public.bb_messages;
