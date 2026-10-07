-- =========================================================================
-- 005 — Cotações alinhadas com a DEGIRO
-- =========================================================================
-- 1) assets.exchange        -> bolsa de referência da DEGIRO (EAM, XET, NDQ...)
-- 2) asset_quotes           -> preço já convertido para EUR, fecho anterior
--                              e variação diária (para "variação do dia")
-- 3) política UPDATE em assets -> sem ela, o símbolo Yahoo descoberto nunca
--    era gravado e a app voltava a procurá-lo em todas as atualizações.
-- 4) capture_net_worth_snapshot passa a usar o preço em EUR.
-- Idempotente.
-- =========================================================================

alter table public.assets add column if not exists exchange text;

alter table public.asset_quotes add column if not exists price_eur numeric(18,6);
alter table public.asset_quotes add column if not exists previous_close_eur numeric(18,6);
alter table public.asset_quotes add column if not exists change_percent numeric(10,4);

drop policy if exists "assets_update_authenticated" on public.assets;
create policy "assets_update_authenticated" on public.assets
  for update using (auth.role() = 'authenticated');

create or replace function public.capture_net_worth_snapshot(p_user_id uuid)
returns void language plpgsql as $$
declare
  v_cash_banks numeric(18,2);
  v_cash_savings numeric(18,2);
  v_cash_brokers numeric(18,2);
  v_cash_physical numeric(18,2);
  v_portfolio_value numeric(18,2);
  v_portfolio_cost numeric(18,2);
begin
  select coalesce(sum(current_balance), 0) into v_cash_banks
  from public.accounts where user_id = p_user_id and type = 'banco' and is_archived = false;

  select coalesce(sum(current_balance), 0) into v_cash_savings
  from public.accounts where user_id = p_user_id and type = 'poupanca' and is_archived = false;

  select coalesce(sum(current_balance), 0) into v_cash_brokers
  from public.accounts where user_id = p_user_id and type = 'corretora' and is_archived = false;

  select coalesce(sum(current_balance), 0) into v_cash_physical
  from public.accounts where user_id = p_user_id and type = 'numerario' and is_archived = false;

  select
    coalesce(sum(coalesce(q.price_eur, case when q.currency = 'EUR' then q.price end, pp.net_invested / nullif(pp.quantity_held, 0)) * pp.quantity_held), 0),
    coalesce(sum(pp.net_invested), 0)
  into v_portfolio_value, v_portfolio_cost
  from public.portfolio_positions pp
  left join public.asset_quotes q on q.asset_id = pp.asset_id
  where pp.user_id = p_user_id and pp.quantity_held > 0.0000001;

  insert into public.net_worth_snapshots (
    user_id, snapshot_date, total_net_worth,
    cash_in_banks, cash_in_savings, cash_in_brokers, physical_cash,
    portfolio_value, portfolio_cost
  ) values (
    p_user_id, current_date,
    v_cash_banks + v_cash_savings + v_cash_brokers + v_cash_physical + v_portfolio_value,
    v_cash_banks, v_cash_savings, v_cash_brokers, v_cash_physical,
    v_portfolio_value, v_portfolio_cost
  )
  on conflict (user_id, snapshot_date) do update set
    total_net_worth = excluded.total_net_worth,
    cash_in_banks = excluded.cash_in_banks,
    cash_in_savings = excluded.cash_in_savings,
    cash_in_brokers = excluded.cash_in_brokers,
    physical_cash = excluded.physical_cash,
    portfolio_value = excluded.portfolio_value,
    portfolio_cost = excluded.portfolio_cost;
end;
$$;
