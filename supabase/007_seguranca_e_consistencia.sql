-- =========================================================================
-- 007 — Segurança e consistência de dados (auditoria)
-- =========================================================================
-- C1  Views deixam de contornar a RLS e deixam de ser legíveis pelo "anon".
-- C2  apply_due_recurring_transactions com lock (sem movimentos duplicados)
--     + datas de fim de mês sem deriva + intervalo > 0.
-- C3  Saldos corretos ao editar/apagar transferências (conta antiga e nova).
-- C4  Saldo da corretora: compras/comissões já não SOMAM ao saldo.
-- C8  suggest_category(p_description) — a categorização automática volta a funcionar.
-- C9  net_invested = custo das unidades que AINDA tens (média ponderada das compras).
-- A1  Policy de UPDATE em csv_imports.
-- A2  Importação atómica numa só transação (import_asset_transactions).
-- A3  Triggers por instrução (1 recálculo por conta em vez de 1 por linha) + lock por conta.
-- Idempotente: pode ser corrido mais do que uma vez.
-- =========================================================================

-- ---------- colunas / constraints ----------
alter table public.assets add column if not exists symbol_resolved_at timestamptz;
alter table public.csv_imports add column if not exists balance numeric(18,2);
alter table public.csv_imports add column if not exists balance_at timestamptz;

do $$ begin
  alter table public.recurring_transactions
    add constraint recurring_interval_positive check (interval_count > 0) not valid;
exception when duplicate_object then null; end $$;

-- ---------- A1: csv_imports UPDATE ----------
drop policy if exists "csv_imports_update_own" on public.csv_imports;
create policy "csv_imports_update_own" on public.csv_imports
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- C9 + C1: portfolio_positions ----------
create or replace view public.portfolio_positions
with (security_invoker = true) as
with agg as (
  select
    at.user_id,
    at.asset_id,
    sum(case when at.operation = 'compra' then at.quantity
             when at.operation = 'venda' then -at.quantity
             else 0 end) as quantity_held,
    sum(case when at.operation = 'compra' then at.quantity else 0 end) as bought_qty,
    sum(case when at.operation = 'compra' then -at.total_value else 0 end) as bought_cost,
    sum(case when at.operation = 'dividendo' then at.total_value else 0 end) as total_dividends,
    coalesce(sum(coalesce(at.fees, 0)), 0)
      + coalesce(sum(case when at.operation = 'comissao' then abs(at.total_value) else 0 end), 0) as total_fees,
    min(case when at.operation = 'compra' then coalesce(at.occurred_at, at.occurred_on::timestamptz) end) as first_purchase_at,
    count(*) filter (where at.operation in ('compra', 'venda')) as trade_count
  from public.asset_transactions at
  group by at.user_id, at.asset_id
)
select
  agg.user_id,
  agg.asset_id,
  ass.name,
  ass.symbol,
  ass.isin,
  ass.currency,
  agg.quantity_held,
  -- custo das unidades que ainda tens (média ponderada de todas as compras)
  case when agg.quantity_held > 0.0000001 and agg.bought_qty > 0
       then agg.quantity_held * agg.bought_cost / agg.bought_qty
       else 0 end as net_invested,
  agg.total_dividends,
  agg.total_fees,
  agg.first_purchase_at,
  agg.trade_count
from agg
join public.assets ass on ass.id = agg.asset_id;

-- ---------- C4 + C1: account_balances ----------
-- total_value é o fluxo de caixa COM SINAL (compra < 0, venda > 0, dividendo > 0,
-- comissão < 0), por isso soma-se tal e qual.
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  coalesce(a.reconciled_balance, a.opening_balance)
    + coalesce(sum(case
                     when t.occurred_on::timestamptz <= coalesce(a.reconciled_at, '-infinity'::timestamptz) then 0
                     when t.type = 'receita' then t.amount
                     when t.type = 'despesa' then -t.amount
                     when t.type = 'transferencia' and t.account_id = a.id then -t.amount
                     else 0 end), 0)
    + coalesce((
        select sum(t2.amount) from public.transactions t2
        where t2.type = 'transferencia' and t2.transfer_account_id = a.id
          and t2.occurred_on::timestamptz > coalesce(a.reconciled_at, '-infinity'::timestamptz)
      ), 0)
    + coalesce((
        select sum(at.total_value) from public.asset_transactions at
        where at.account_id = a.id and at.operation in ('compra', 'venda', 'dividendo', 'comissao')
          and coalesce(at.occurred_at, at.occurred_on::timestamptz) > coalesce(a.reconciled_at, '-infinity'::timestamptz)
      ), 0)
  as current_balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

-- ---------- C1: budget_status ----------
alter view public.budget_status set (security_invoker = true);

revoke all on public.account_balances, public.portfolio_positions, public.budget_status from anon;

-- ---------- A3: triggers por instrução + lock por conta ----------
create or replace function public.refresh_account_balance(p_account_id uuid)
returns void language plpgsql as $$
begin
  -- serializa recálculos concorrentes da mesma conta (evita "lost update")
  perform 1 from public.accounts where id = p_account_id for update;
  update public.accounts a
  set current_balance = coalesce(v.current_balance, a.opening_balance),
      updated_at = now()
  from public.account_balances v
  where v.account_id = a.id and a.id = p_account_id;
end;
$$;

create or replace function public.refresh_accounts(p_ids uuid[])
returns void language plpgsql as $$
declare v uuid;
begin
  -- ordem fixa => sem deadlocks entre transações que tocam em várias contas
  for v in select distinct x from unnest(p_ids) as x where x is not null order by x loop
    perform public.refresh_account_balance(v);
  end loop;
end;
$$;

drop trigger if exists transactions_balance_trigger on public.transactions;
drop trigger if exists asset_transactions_balance_trigger on public.asset_transactions;
drop trigger if exists transactions_balance_ins on public.transactions;
drop trigger if exists transactions_balance_upd on public.transactions;
drop trigger if exists transactions_balance_del on public.transactions;
drop trigger if exists asset_tx_balance_ins on public.asset_transactions;
drop trigger if exists asset_tx_balance_upd on public.asset_transactions;
drop trigger if exists asset_tx_balance_del on public.asset_transactions;

create or replace function public.trg_tx_stmt_ins() returns trigger language plpgsql as $$
begin
  perform public.refresh_accounts(array(
    select account_id from new_rows union all select transfer_account_id from new_rows));
  return null;
end; $$;

create or replace function public.trg_tx_stmt_upd() returns trigger language plpgsql as $$
begin
  perform public.refresh_accounts(array(
    select account_id from old_rows union all select transfer_account_id from old_rows
    union all select account_id from new_rows union all select transfer_account_id from new_rows));
  return null;
end; $$;

create or replace function public.trg_tx_stmt_del() returns trigger language plpgsql as $$
begin
  perform public.refresh_accounts(array(
    select account_id from old_rows union all select transfer_account_id from old_rows));
  return null;
end; $$;

create trigger transactions_balance_ins after insert on public.transactions
  referencing new table as new_rows for each statement execute function public.trg_tx_stmt_ins();
create trigger transactions_balance_upd after update on public.transactions
  referencing old table as old_rows new table as new_rows for each statement execute function public.trg_tx_stmt_upd();
create trigger transactions_balance_del after delete on public.transactions
  referencing old table as old_rows for each statement execute function public.trg_tx_stmt_del();

create or replace function public.trg_atx_stmt_ins() returns trigger language plpgsql as $$
begin
  perform public.refresh_accounts(array(select account_id from new_rows));
  return null;
end; $$;

create or replace function public.trg_atx_stmt_upd() returns trigger language plpgsql as $$
begin
  perform public.refresh_accounts(array(
    select account_id from old_rows union all select account_id from new_rows));
  return null;
end; $$;

create or replace function public.trg_atx_stmt_del() returns trigger language plpgsql as $$
begin
  perform public.refresh_accounts(array(select account_id from old_rows));
  return null;
end; $$;

create trigger asset_tx_balance_ins after insert on public.asset_transactions
  referencing new table as new_rows for each statement execute function public.trg_atx_stmt_ins();
create trigger asset_tx_balance_upd after update on public.asset_transactions
  referencing old table as old_rows new table as new_rows for each statement execute function public.trg_atx_stmt_upd();
create trigger asset_tx_balance_del after delete on public.asset_transactions
  referencing old table as old_rows for each statement execute function public.trg_atx_stmt_del();

-- ---------- C2 + A7: recorrências ----------
create or replace function public._recurrence_date(p_start date, p_freq recurrence_frequency, p_every integer, p_k integer)
returns date language sql immutable as $$
  select case p_freq
    when 'diaria'  then p_start + (p_every * p_k)
    when 'semanal' then p_start + (7 * p_every * p_k)
    when 'mensal'  then (p_start + make_interval(months => p_every * p_k))::date
    when 'anual'   then (p_start + make_interval(years  => p_every * p_k))::date
  end;
$$;

create or replace function public.apply_due_recurring_transactions(p_user_id uuid)
returns void language plpgsql as $$
declare
  r record;
  v_k integer;
  v_next date;
  v_guard integer;
  v_today date := (now() at time zone 'Europe/Lisbon')::date;
begin
  -- só uma execução por utilizador de cada vez; a 2.ª espera e já não encontra nada em atraso
  perform pg_advisory_xact_lock(hashtextextended('recurring:' || p_user_id::text, 0));

  for r in
    select * from public.recurring_transactions
    where user_id = p_user_id and is_active = true and next_occurrence <= v_today
    for update
  loop
    -- posição k da próxima ocorrência na grelha start_date + k*passo (sem deriva em fins de mês)
    v_k := 0; v_next := r.start_date; v_guard := 0;
    while v_next < r.next_occurrence and v_guard < 20000 loop
      v_k := v_k + 1; v_guard := v_guard + 1;
      v_next := public._recurrence_date(r.start_date, r.frequency, greatest(r.interval_count, 1), v_k);
    end loop;

    v_guard := 0;
    while v_next <= v_today and (r.end_date is null or v_next <= r.end_date) and v_guard < 2000 loop
      insert into public.transactions (
        user_id, type, amount, occurred_on, account_id, transfer_account_id, category_id, description
      ) values (
        r.user_id, r.type, r.amount, v_next, r.account_id, r.transfer_account_id, r.category_id, r.description
      );
      v_k := v_k + 1; v_guard := v_guard + 1;
      v_next := public._recurrence_date(r.start_date, r.frequency, greatest(r.interval_count, 1), v_k);
    end loop;

    update public.recurring_transactions
    set next_occurrence = v_next,
        is_active = case when r.end_date is not null and v_next > r.end_date then false else is_active end
    where id = r.id;
  end loop;
end;
$$;

-- ---------- C8: categorização automática ----------
create or replace function public.suggest_category(p_description text)
returns uuid language sql stable as $$
  select public.suggest_category(auth.uid(), p_description);
$$;

-- ---------- A2: importação atómica ----------
create or replace function public.import_asset_transactions(
  p_account_id uuid,
  p_file_name text,
  p_file_hash text,
  p_rows_failed integer,
  p_rows jsonb,
  p_balance numeric default null,
  p_balance_at timestamptz default null
)
returns jsonb language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_import uuid;
  v_total integer;
  v_inserted integer;
begin
  if v_user is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_user) then
    raise exception 'Conta inválida.' using errcode = '42501';
  end if;

  v_total := jsonb_array_length(p_rows);

  insert into public.csv_imports (user_id, account_id, file_name, file_hash, rows_total, rows_failed, balance, balance_at)
  values (v_user, p_account_id, p_file_name, p_file_hash, v_total, coalesce(p_rows_failed, 0), p_balance, p_balance_at)
  returning id into v_import;

  with ins as (
    insert into public.asset_transactions (
      user_id, account_id, asset_id, import_id, operation, occurred_on, occurred_at, quantity, price,
      local_value, fees, total_value, currency, exchange_rate, description, order_id, source_hash, source, raw_row
    )
    select v_user, p_account_id, x.asset_id, v_import, x.operation, x.occurred_on, x.occurred_at, x.quantity, x.price,
           x.local_value, coalesce(x.fees, 0), x.total_value, x.currency, x.exchange_rate, x.description,
           x.order_id, x.source_hash, 'degiro', x.raw_row
    from jsonb_to_recordset(p_rows) as x(
      asset_id uuid, operation asset_operation, occurred_on date, occurred_at timestamptz, quantity numeric,
      price numeric, local_value numeric, fees numeric, total_value numeric, currency text,
      exchange_rate numeric, description text, order_id text, source_hash text, raw_row jsonb
    )
    on conflict (user_id, source_hash) do nothing
    returning 1
  )
  select count(*) into v_inserted from ins;

  update public.csv_imports
  set rows_inserted = v_inserted, rows_duplicated = v_total - v_inserted
  where id = v_import;

  if p_balance is not null and p_balance_at is not null then
    perform public.reconcile_account_balance(p_account_id, p_balance, p_balance_at);
  end if;

  return jsonb_build_object('import_id', v_import, 'rows_inserted', v_inserted, 'rows_duplicated', v_total - v_inserted);
end;
$$;


-- ---------- A2: desfazer importações de forma atómica ----------
-- Apaga a importação (e, por cascade, as suas transações) e volta a calcular
-- o saldo reconciliado a partir da importação anterior mais recente (ou nenhum).
create or replace function public.undo_import(p_import_id uuid)
returns jsonb language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_account uuid;
  v_name text;
  v_rows integer;
begin
  if v_user is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  select account_id, file_name, rows_inserted into v_account, v_name, v_rows
  from public.csv_imports where id = p_import_id and user_id = v_user;
  if not found then
    raise exception 'Importação não encontrada.' using errcode = 'P0002';
  end if;

  delete from public.csv_imports where id = p_import_id;

  if v_account is not null then
    update public.accounts a
    set reconciled_balance = (select ci.balance from public.csv_imports ci
                              where ci.account_id = v_account and ci.user_id = v_user and ci.balance_at is not null
                              order by ci.balance_at desc limit 1),
        reconciled_at = (select ci.balance_at from public.csv_imports ci
                         where ci.account_id = v_account and ci.user_id = v_user and ci.balance_at is not null
                         order by ci.balance_at desc limit 1)
    where a.id = v_account and a.user_id = v_user;
    perform public.refresh_account_balance(v_account);
  end if;

  return jsonb_build_object('file_name', v_name, 'rows_inserted', v_rows);
end;
$$;

create or replace function public.wipe_imports()
returns jsonb language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_accounts uuid[];
begin
  if v_user is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  select coalesce(array_agg(distinct s.account_id), '{}') into v_accounts
  from (
    select account_id from public.asset_transactions where user_id = v_user
    union
    select account_id from public.csv_imports where user_id = v_user and account_id is not null
  ) s;

  delete from public.asset_transactions where user_id = v_user;
  delete from public.csv_imports where user_id = v_user;
  update public.accounts set reconciled_balance = null, reconciled_at = null
  where user_id = v_user and id = any(v_accounts);
  perform public.refresh_accounts(v_accounts);

  return jsonb_build_object('accounts', coalesce(array_length(v_accounts, 1), 0));
end;
$$;

revoke execute on function public.undo_import(uuid) from public, anon;
grant  execute on function public.undo_import(uuid) to authenticated;
revoke execute on function public.wipe_imports() from public, anon;
grant  execute on function public.wipe_imports() to authenticated;

-- funções de manutenção: só utilizadores autenticados
revoke execute on function public.import_asset_transactions(uuid, text, text, integer, jsonb, numeric, timestamptz) from public, anon;
grant  execute on function public.import_asset_transactions(uuid, text, text, integer, jsonb, numeric, timestamptz) to authenticated;
revoke execute on function public.apply_due_recurring_transactions(uuid) from public, anon;
grant  execute on function public.apply_due_recurring_transactions(uuid) to authenticated;
revoke execute on function public.capture_net_worth_snapshot(uuid) from public, anon;
grant  execute on function public.capture_net_worth_snapshot(uuid) to authenticated;

-- ---------- recalcula todos os saldos com as regras corrigidas ----------
select public.refresh_account_balance(id) from public.accounts;
