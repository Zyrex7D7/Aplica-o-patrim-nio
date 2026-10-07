-- Radar: lista de ativos em observação (watchlist). Idempotente.
create table if not exists public.watchlist (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  symbol       text not null,
  name         text not null,
  currency     text not null default 'EUR',
  added_price  numeric(18,6),
  added_at     timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists idx_watchlist_user on public.watchlist(user_id);
alter table public.watchlist enable row level security;

drop policy if exists "watchlist_select_own" on public.watchlist;
create policy "watchlist_select_own" on public.watchlist for select using (auth.uid() = user_id);
drop policy if exists "watchlist_insert_own" on public.watchlist;
create policy "watchlist_insert_own" on public.watchlist for insert with check (auth.uid() = user_id);
drop policy if exists "watchlist_delete_own" on public.watchlist;
create policy "watchlist_delete_own" on public.watchlist for delete using (auth.uid() = user_id);
