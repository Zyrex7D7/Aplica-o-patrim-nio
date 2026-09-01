-- =========================================================================
-- Meu Capital — Esquema Supabase (Postgres) COMPLETO E CONSOLIDADO
-- =========================================================================
-- Junta num único ficheiro: schema.sql + 002_melhorias.sql (reconstruído,
-- ver aviso abaixo) + 003_correcoes_build.sql +
-- 004_regras_categorizacao_e_taxas.sql + 004_remover_importacao.sql.
--
-- Idempotente: pode ser corrido em segurança tanto numa base de dados nova
-- como numa que já tenha parte disto (create table/view/function usam
-- if not exists / or replace em todo o lado).
--
-- ⚠️ AVISO IMPORTANTE sobre a secção 10 (RECONSTRUÍDA):
-- As tabelas `recurring_transactions`, `budgets`, `net_worth_snapshots` e
-- as funções `apply_due_recurring_transactions`, `get_realized_pnl` e
-- `capture_net_worth_snapshot` são usadas pelo código da app mas a sua
-- definição original (presumivelmente num ficheiro "002_melhorias.sql")
-- nunca foi partilhada. Reconstruí-as aqui a partir do que o código
-- pressupõe (nomes de tabelas/colunas em types/database.ts, chamadas RPC).
-- Se já tens estes objetos na tua base de dados REAL com uma lógica
-- diferente (nomeadamente `get_realized_pnl`, que pode usar FIFO em vez de
-- custo médio), correr este script vai SUBSTITUIR essa lógica e os
-- números de "Lucro Realizado" podem mudar. Revê a secção 10 antes de
-- correr em produção, ou salta-a se já tiveres a tua própria versão.
-- =========================================================================


-- =========================================================================
-- 1. EXTENSÕES
-- =========================================================================
create extension if not exists "pgcrypto";


-- =========================================================================
-- 2. TIPOS ENUMERADOS
-- =========================================================================
do $$ begin
  create type account_type as enum ('banco', 'corretora', 'numerario', 'poupanca');
exception when duplicate_object then null;
end $$;
alter type account_type add value if not exists 'poupanca';

do $$ begin
  create type category_kind as enum ('receita', 'despesa');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type transaction_type as enum ('receita', 'despesa', 'transferencia');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type asset_operation as enum ('compra', 'venda', 'dividendo', 'comissao', 'outro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type recurrence_frequency as enum ('diaria', 'semanal', 'mensal', 'anual');
exception when duplicate_object then null;
end $$;


-- =========================================================================
-- 3. CONTAS
-- =========================================================================
create table if not exists public.accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  type                account_type not null,
  currency            text not null default 'EUR',
  institution         text,
  opening_balance     numeric(18,2) not null default 0,
  -- Ponto de reconciliação: quando importamos um extrato DEGIRO, confiamos
  -- no saldo que a própria DEGIRO reporta em vez de recalcular tudo a
  -- partir das nossas transações (captura depósitos, levantamentos, cash
  -- sweeps, juros, etc. que não modelamos individualmente). A partir daqui
  -- só somamos movimentos que aconteçam DEPOIS de reconciled_at.
  reconciled_balance  numeric(18,2),
  reconciled_at       timestamptz,
  current_balance     numeric(18,2) not null default 0,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.accounts add column if not exists reconciled_balance numeric(18,2);
alter table public.accounts add column if not exists reconciled_at timestamptz;

create index if not exists idx_accounts_user on public.accounts(user_id);


-- =========================================================================
-- 4. CATEGORIAS
-- =========================================================================
create table if not exists public.categories (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  kind                  category_kind not null,
  color                 text default '#8B93A1',
  icon                  text,
  is_default            boolean not null default false,
  -- Categorias "ajuste" ficam de fora dos totais de receitas/despesas nos
  -- relatórios (ex: correções de saldo, movimentos internos).
  exclude_from_reports  boolean not null default false,
  -- Marca esta categoria como representando uma comissão/taxa (ex:
  -- "Comissões Bancárias"), para entrar no resumo de Comissões e Taxas.
  is_fee                boolean not null default false,
  created_at            timestamptz not null default now(),
  unique (user_id, name, kind)
);

alter table public.categories add column if not exists exclude_from_reports boolean not null default false;
alter table public.categories add column if not exists is_fee boolean not null default false;


-- =========================================================================
-- 5. TRANSAÇÕES DE ORÇAMENTO (receitas / despesas / transferências)
-- =========================================================================
create table if not exists public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  type                  transaction_type not null,
  amount                numeric(18,2) not null check (amount > 0),
  occurred_on           date not null,
  account_id            uuid not null references public.accounts(id) on delete cascade,
  transfer_account_id   uuid references public.accounts(id) on delete set null,
  category_id           uuid references public.categories(id) on delete set null,
  description           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    (type = 'transferencia' and transfer_account_id is not null and transfer_account_id <> account_id)
    or (type <> 'transferencia' and transfer_account_id is null)
  )
);

create index if not exists idx_transactions_user_date on public.transactions(user_id, occurred_on desc);
create index if not exists idx_transactions_account on public.transactions(account_id);
create index if not exists idx_transactions_category on public.transactions(category_id);


-- =========================================================================
-- 6. ATIVOS (instrumentos financeiros)
-- =========================================================================
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  isin        text unique,
  symbol      text,
  name        text not null,
  currency    text not null default 'EUR',
  created_at  timestamptz not null default now()
);

create index if not exists idx_assets_isin on public.assets(isin);
create index if not exists idx_assets_symbol on public.assets(symbol);


-- =========================================================================
-- 7. TRANSAÇÕES DE BOLSA (compras, vendas, dividendos, comissões — DEGIRO)
-- =========================================================================
create table if not exists public.asset_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  asset_id        uuid not null references public.assets(id) on delete cascade,
  -- Liga esta transação à importação DEGIRO que a criou. Com
  -- "on delete cascade", apagar a linha em csv_imports apaga
  -- automaticamente todas as transações que essa importação trouxe.
  import_id       uuid references public.csv_imports(id) on delete cascade,
  operation       asset_operation not null,
  occurred_on     date not null,
  occurred_at     timestamptz,
  quantity        numeric(18,6),
  price           numeric(18,6),
  local_value     numeric(18,2),
  fees            numeric(18,2) default 0,
  total_value     numeric(18,2) not null,
  currency        text default 'EUR',
  exchange_rate   numeric(18,6),
  description     text,
  order_id        text,
  source_hash     text not null,
  source          text not null default 'degiro',
  raw_row         jsonb,
  created_at      timestamptz not null default now(),
  unique (user_id, source_hash)
);
-- Nota de ordem: csv_imports é criada na secção 9, mas o Postgres resolve
-- a referência acima na mesma transação de execução do script; se
-- preferires correr isto por partes, cria primeiro csv_imports (secção 9)
-- e só depois esta tabela, ou usa a versão idempotente abaixo:
alter table public.asset_transactions add column if not exists import_id uuid references public.csv_imports(id) on delete cascade;

create index if not exists idx_asset_tx_user_date on public.asset_transactions(user_id, occurred_on desc);
create index if not exists idx_asset_tx_asset on public.asset_transactions(asset_id);
create index if not exists idx_asset_tx_account on public.asset_transactions(account_id);
create index if not exists idx_asset_tx_import on public.asset_transactions(import_id);


-- =========================================================================
-- 8. COTAÇÕES (cache de preços atuais)
-- =========================================================================
create table if not exists public.asset_quotes (
  asset_id      uuid primary key references public.assets(id) on delete cascade,
  price         numeric(18,6) not null,
  currency      text not null default 'EUR',
  fetched_at    timestamptz not null default now()
);


-- =========================================================================
-- 9. IMPORTAÇÕES CSV (histórico/auditoria de uploads DEGIRO)
-- =========================================================================
create table if not exists public.csv_imports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid references public.accounts(id) on delete set null,
  file_name       text not null,
  file_hash       text not null,
  rows_total      integer not null default 0,
  rows_inserted   integer not null default 0,
  rows_duplicated integer not null default 0,
  rows_failed     integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (user_id, file_hash)
);


-- =========================================================================
-- 10. RECONSTRUÍDO — recorrências, orçamentos, histórico de património
-- =========================================================================
-- Ver aviso no topo do ficheiro. Estas definições foram inferidas do
-- código (types/database.ts + chamadas RPC), não copiadas do teu
-- "002_melhorias.sql" original (que não foi partilhado).

-- 10.1 Recorrências (renda, salário, subscrições...)
create table if not exists public.recurring_transactions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  type                  transaction_type not null,
  amount                numeric(18,2) not null check (amount > 0),
  account_id            uuid not null references public.accounts(id) on delete cascade,
  transfer_account_id   uuid references public.accounts(id) on delete set null,
  category_id           uuid references public.categories(id) on delete set null,
  description           text,
  frequency             recurrence_frequency not null default 'mensal',
  interval_count        integer not null default 1,
  start_date            date not null,
  end_date              date,
  next_occurrence       date not null,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

create index if not exists idx_recurring_user on public.recurring_transactions(user_id);

-- Gera os movimentos de qualquer recorrência vencida (next_occurrence <=
-- hoje) e avança next_occurrence — repete até estar em dia ou até
-- ultrapassar end_date, altura em que desativa a recorrência sozinha.
create or replace function public.apply_due_recurring_transactions(p_user_id uuid)
returns void language plpgsql as $$
declare
  r record;
  v_next date;
begin
  for r in
    select * from public.recurring_transactions
    where user_id = p_user_id and is_active = true and next_occurrence <= current_date
  loop
    v_next := r.next_occurrence;
    while v_next <= current_date and (r.end_date is null or v_next <= r.end_date) loop
      insert into public.transactions (
        user_id, type, amount, occurred_on, account_id, transfer_account_id, category_id, description
      ) values (
        r.user_id, r.type, r.amount, v_next, r.account_id, r.transfer_account_id, r.category_id, r.description
      );

      v_next := case r.frequency
        when 'diaria'  then v_next + (r.interval_count || ' days')::interval
        when 'semanal' then v_next + (r.interval_count || ' weeks')::interval
        when 'mensal'  then v_next + (r.interval_count || ' months')::interval
        when 'anual'   then v_next + (r.interval_count || ' years')::interval
      end;
    end loop;

    update public.recurring_transactions
    set next_occurrence = v_next,
        is_active = case when r.end_date is not null and v_next > r.end_date then false else is_active end
    where id = r.id;
  end loop;
end;
$$;

-- 10.2 Orçamentos mensais por categoria
create table if not exists public.budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  category_id     uuid not null references public.categories(id) on delete cascade,
  monthly_limit   numeric(18,2) not null check (monthly_limit > 0),
  created_at      timestamptz not null default now(),
  unique (user_id, category_id)
);

create or replace view public.budget_status as
select
  b.user_id,
  b.category_id,
  c.name as category_name,
  c.color as category_color,
  b.monthly_limit,
  coalesce(sum(t.amount) filter (
    where t.type = 'despesa'
      and t.occurred_on >= date_trunc('month', current_date)::date
      and t.occurred_on < (date_trunc('month', current_date) + interval '1 month')::date
  ), 0) as spent_this_month
from public.budgets b
join public.categories c on c.id = b.category_id
left join public.transactions t on t.category_id = b.category_id and t.user_id = b.user_id
group by b.user_id, b.category_id, c.name, c.color, b.monthly_limit;

-- 10.3 Histórico diário de património, para o gráfico de evolução
create table if not exists public.net_worth_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  snapshot_date       date not null,
  total_net_worth     numeric(18,2) not null,
  cash_in_banks       numeric(18,2) not null default 0,
  cash_in_savings     numeric(18,2) not null default 0,
  cash_in_brokers     numeric(18,2) not null default 0,
  physical_cash       numeric(18,2) not null default 0,
  portfolio_value     numeric(18,2) not null default 0,
  portfolio_cost      numeric(18,2) not null default 0,
  created_at          timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists idx_net_worth_snapshots_user_date
  on public.net_worth_snapshots(user_id, snapshot_date);

-- Faz upsert do snapshot de HOJE, recalculado a partir das contas +
-- portfolio_positions + asset_quotes — a mesma lógica de
-- lib/data/net-worth.ts, mas em SQL, para não depender de a app estar
-- aberta em todos os dias para capturar o ponto.
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
    coalesce(sum(case when q.price is not null then q.price * pp.quantity_held else pp.net_invested end), 0),
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

-- 10.4 Lucro realizado por ativo (custo médio, mesma metodologia usada em
-- portfolio_positions/HoldingsTable — não é FIFO). Para cada venda, o
-- custo é o preço médio de compra acumulado até esse ponto no tempo.
create or replace function public.get_realized_pnl(p_user_id uuid)
returns table(asset_id uuid, realized_pnl numeric)
language sql stable as $$
  with tx as (
    select
      at.asset_id,
      at.operation,
      at.quantity,
      at.total_value,
      coalesce(at.occurred_at, at.occurred_on::timestamptz) as ts
    from public.asset_transactions at
    where at.user_id = p_user_id
      and at.operation in ('compra', 'venda')
  ),
  ordered as (
    select *, row_number() over (partition by asset_id order by ts) as rn
    from tx
  ),
  running as (
    select
      *,
      sum(case when operation = 'compra' then quantity else 0 end)
        over (partition by asset_id order by rn) as cum_bought_qty,
      sum(case when operation = 'compra' then -total_value else 0 end)
        over (partition by asset_id order by rn) as cum_bought_cost
    from ordered
  )
  select
    asset_id,
    coalesce(sum(case when operation = 'venda' then
      total_value - quantity * (cum_bought_cost / nullif(cum_bought_qty, 0))
    else 0 end), 0) as realized_pnl
  from running
  group by asset_id;
$$;


-- =========================================================================
-- 11. CATEGORIZAÇÃO AUTOMÁTICA (regras palavra-chave → categoria)
-- =========================================================================
create table if not exists public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  keyword     text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  priority    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

create index if not exists idx_category_rules_user on public.category_rules(user_id);

-- Sugere a categoria cuja palavra-chave mais longa (mais específica)
-- aparece no texto; em empate, ganha a de maior "priority".
create or replace function public.suggest_category(p_user_id uuid, p_description text)
returns uuid language sql stable as $$
  select cr.category_id
  from public.category_rules cr
  where cr.user_id = p_user_id
    and p_description is not null
    and position(lower(cr.keyword) in lower(p_description)) > 0
  order by length(cr.keyword) desc, cr.priority desc
  limit 1;
$$;

-- Marca a categoria por omissão já existente como sendo uma taxa.
update public.categories set is_fee = true where name = 'Comissões Bancárias' and kind = 'despesa';

-- Resumo agregado: comissões bancárias (categorias is_fee=true) +
-- comissões de investimento (avulsas + embutidas nas transações DEGIRO).
create or replace function public.get_fees_summary(p_user_id uuid, p_from date default '1900-01-01')
returns table(banking_fees numeric, investment_fees numeric, total_fees numeric)
language sql stable as $$
  select
    b.banking_fees,
    i.investment_fees,
    b.banking_fees + i.investment_fees as total_fees
  from
    (
      select coalesce(sum(t.amount), 0) as banking_fees
      from public.transactions t
      join public.categories c on c.id = t.category_id
      where t.user_id = p_user_id
        and c.is_fee = true
        and t.type = 'despesa'
        and t.occurred_on >= p_from
    ) b,
    (
      select
        coalesce(sum(coalesce(at.fees, 0)), 0)
          + coalesce(sum(case when at.operation = 'comissao' then abs(at.total_value) else 0 end), 0)
          as investment_fees
      from public.asset_transactions at
      where at.user_id = p_user_id
        and coalesce(at.occurred_at, at.occurred_on::timestamptz) >= p_from::timestamptz
    ) i;
$$;

-- Lista detalhada das linhas que compõem as comissões/taxas.
create or replace function public.get_fee_transactions(p_user_id uuid, p_from date default '1900-01-01')
returns table(occurred_on date, source text, description text, amount numeric)
language sql stable as $$
  select t.occurred_on, 'Bancária'::text as source,
         coalesce(t.description, c.name) as description, t.amount
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.user_id = p_user_id and c.is_fee = true and t.type = 'despesa' and t.occurred_on >= p_from

  union all

  select at.occurred_on, 'Investimento'::text as source,
         coalesce(at.description, ass.name) as description, abs(at.total_value) as amount
  from public.asset_transactions at
  join public.assets ass on ass.id = at.asset_id
  where at.user_id = p_user_id and at.operation = 'comissao'
    and coalesce(at.occurred_at, at.occurred_on::timestamptz) >= p_from::timestamptz

  union all

  select at.occurred_on, 'Investimento (embutida)'::text as source,
         ass.name || ' — ' || at.operation as description, at.fees as amount
  from public.asset_transactions at
  join public.assets ass on ass.id = at.asset_id
  where at.user_id = p_user_id and coalesce(at.fees, 0) > 0
    and coalesce(at.occurred_at, at.occurred_on::timestamptz) >= p_from::timestamptz

  order by occurred_on desc;
$$;


-- =========================================================================
-- 12. VIEWS PRINCIPAIS
-- =========================================================================

-- Saldo corrente de cada conta, a partir de opening/reconciled_balance +
-- transações posteriores ao ponto de reconciliação.
create or replace view public.account_balances as
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
        select sum(-at.total_value) from public.asset_transactions at
        where at.account_id = a.id and at.operation in ('compra','comissao')
          and coalesce(at.occurred_at, at.occurred_on::timestamptz) > coalesce(a.reconciled_at, '-infinity'::timestamptz)
      ), 0)
    + coalesce((
        select sum(at.total_value) from public.asset_transactions at
        where at.account_id = a.id and at.operation in ('venda','dividendo')
          and coalesce(at.occurred_at, at.occurred_on::timestamptz) > coalesce(a.reconciled_at, '-infinity'::timestamptz)
      ), 0)
  as current_balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

-- Posições atuais do portefólio (versão final, com total_fees e
-- first_purchase_at — equivalente ao estado depois de 003_correcoes_build.sql).
create or replace view public.portfolio_positions as
select
  at.user_id,
  at.asset_id,
  ass.name,
  ass.symbol,
  ass.isin,
  ass.currency,
  sum(case when at.operation = 'compra' then at.quantity
           when at.operation = 'venda' then -at.quantity
           else 0 end) as quantity_held,
  sum(case when at.operation in ('compra', 'venda') then -at.total_value
           else 0 end) as net_invested,
  sum(case when at.operation = 'dividendo' then at.total_value else 0 end) as total_dividends,
  coalesce(sum(coalesce(at.fees, 0)), 0)
    + coalesce(sum(case when at.operation = 'comissao' then abs(at.total_value) else 0 end), 0)
    as total_fees,
  min(case when at.operation = 'compra' then coalesce(at.occurred_at, at.occurred_on::timestamptz) end)
    as first_purchase_at,
  count(*) filter (where at.operation in ('compra', 'venda')) as trade_count
from public.asset_transactions at
join public.assets ass on ass.id = at.asset_id
group by at.user_id, at.asset_id, ass.name, ass.symbol, ass.isin, ass.currency;


-- =========================================================================
-- 13. TRIGGERS — manter accounts.current_balance sincronizado
-- =========================================================================
create or replace function public.refresh_account_balance(p_account_id uuid)
returns void language plpgsql as $$
begin
  update public.accounts a
  set current_balance = coalesce(v.current_balance, a.opening_balance),
      updated_at = now()
  from public.account_balances v
  where v.account_id = a.id and a.id = p_account_id;
end;
$$;

-- Fixa o saldo de uma conta a um valor conhecido num instante (ex: o saldo
-- que a DEGIRO reportou na última linha de um extrato). Só avança o ponto
-- de reconciliação para a frente — reimportar um ficheiro mais antigo
-- nunca faz a conta "recuar".
create or replace function public.reconcile_account_balance(
  p_account_id uuid, p_balance numeric, p_at timestamptz
)
returns void language plpgsql as $$
begin
  update public.accounts
  set reconciled_balance = p_balance, reconciled_at = p_at
  where id = p_account_id
    and (reconciled_at is null or p_at > reconciled_at);

  perform public.refresh_account_balance(p_account_id);
end;
$$;

create or replace function public.trg_transactions_refresh_balance()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    perform public.refresh_account_balance(old.account_id);
    if old.transfer_account_id is not null then
      perform public.refresh_account_balance(old.transfer_account_id);
    end if;
    return old;
  else
    perform public.refresh_account_balance(new.account_id);
    if new.transfer_account_id is not null then
      perform public.refresh_account_balance(new.transfer_account_id);
    end if;
    if TG_OP = 'UPDATE' and old.account_id <> new.account_id then
      perform public.refresh_account_balance(old.account_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists transactions_balance_trigger on public.transactions;
create trigger transactions_balance_trigger
after insert or update or delete on public.transactions
for each row execute function public.trg_transactions_refresh_balance();

create or replace function public.trg_asset_transactions_refresh_balance()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    perform public.refresh_account_balance(old.account_id);
    return old;
  else
    perform public.refresh_account_balance(new.account_id);
    return new;
  end if;
end;
$$;

drop trigger if exists asset_transactions_balance_trigger on public.asset_transactions;
create trigger asset_transactions_balance_trigger
after insert or update or delete on public.asset_transactions
for each row execute function public.trg_asset_transactions_refresh_balance();


-- =========================================================================
-- 14. ROW LEVEL SECURITY
-- =========================================================================
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.asset_transactions enable row level security;
alter table public.csv_imports enable row level security;
alter table public.assets enable row level security;
alter table public.asset_quotes enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.net_worth_snapshots enable row level security;
alter table public.category_rules enable row level security;

-- accounts
drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts for select using (auth.uid() = user_id);
drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own" on public.accounts for insert with check (auth.uid() = user_id);
drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own" on public.accounts for update using (auth.uid() = user_id);
drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own" on public.accounts for delete using (auth.uid() = user_id);

-- categories
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories for select using (auth.uid() = user_id);
drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories for insert with check (auth.uid() = user_id);
drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories for update using (auth.uid() = user_id);
drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories for delete using (auth.uid() = user_id);

-- transactions
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions for update using (auth.uid() = user_id);
drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions for delete using (auth.uid() = user_id);

-- asset_transactions
drop policy if exists "asset_tx_select_own" on public.asset_transactions;
create policy "asset_tx_select_own" on public.asset_transactions for select using (auth.uid() = user_id);
drop policy if exists "asset_tx_insert_own" on public.asset_transactions;
create policy "asset_tx_insert_own" on public.asset_transactions for insert with check (auth.uid() = user_id);
drop policy if exists "asset_tx_update_own" on public.asset_transactions;
create policy "asset_tx_update_own" on public.asset_transactions for update using (auth.uid() = user_id);
drop policy if exists "asset_tx_delete_own" on public.asset_transactions;
create policy "asset_tx_delete_own" on public.asset_transactions for delete using (auth.uid() = user_id);

-- csv_imports
drop policy if exists "csv_imports_select_own" on public.csv_imports;
create policy "csv_imports_select_own" on public.csv_imports for select using (auth.uid() = user_id);
drop policy if exists "csv_imports_insert_own" on public.csv_imports;
create policy "csv_imports_insert_own" on public.csv_imports for insert with check (auth.uid() = user_id);
drop policy if exists "csv_imports_delete_own" on public.csv_imports;
create policy "csv_imports_delete_own" on public.csv_imports for delete using (auth.uid() = user_id);

-- assets & quotes: catálogo partilhado, leitura para todos os autenticados
drop policy if exists "assets_select_all_authenticated" on public.assets;
create policy "assets_select_all_authenticated" on public.assets for select using (auth.role() = 'authenticated');
drop policy if exists "assets_insert_authenticated" on public.assets;
create policy "assets_insert_authenticated" on public.assets for insert with check (auth.role() = 'authenticated');
drop policy if exists "asset_quotes_select_all_authenticated" on public.asset_quotes;
create policy "asset_quotes_select_all_authenticated" on public.asset_quotes for select using (auth.role() = 'authenticated');
drop policy if exists "asset_quotes_upsert_authenticated" on public.asset_quotes;
create policy "asset_quotes_upsert_authenticated" on public.asset_quotes for insert with check (auth.role() = 'authenticated');
drop policy if exists "asset_quotes_update_authenticated" on public.asset_quotes;
create policy "asset_quotes_update_authenticated" on public.asset_quotes for update using (auth.role() = 'authenticated');

-- recurring_transactions
drop policy if exists "recurring_select_own" on public.recurring_transactions;
create policy "recurring_select_own" on public.recurring_transactions for select using (auth.uid() = user_id);
drop policy if exists "recurring_insert_own" on public.recurring_transactions;
create policy "recurring_insert_own" on public.recurring_transactions for insert with check (auth.uid() = user_id);
drop policy if exists "recurring_update_own" on public.recurring_transactions;
create policy "recurring_update_own" on public.recurring_transactions for update using (auth.uid() = user_id);
drop policy if exists "recurring_delete_own" on public.recurring_transactions;
create policy "recurring_delete_own" on public.recurring_transactions for delete using (auth.uid() = user_id);

-- budgets
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets for select using (auth.uid() = user_id);
drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets for insert with check (auth.uid() = user_id);
drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets for update using (auth.uid() = user_id);
drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets for delete using (auth.uid() = user_id);

-- net_worth_snapshots
drop policy if exists "net_worth_snapshots_select_own" on public.net_worth_snapshots;
create policy "net_worth_snapshots_select_own" on public.net_worth_snapshots for select using (auth.uid() = user_id);
drop policy if exists "net_worth_snapshots_insert_own" on public.net_worth_snapshots;
create policy "net_worth_snapshots_insert_own" on public.net_worth_snapshots for insert with check (auth.uid() = user_id);
drop policy if exists "net_worth_snapshots_update_own" on public.net_worth_snapshots;
create policy "net_worth_snapshots_update_own" on public.net_worth_snapshots for update using (auth.uid() = user_id);

-- category_rules
drop policy if exists "category_rules_select_own" on public.category_rules;
create policy "category_rules_select_own" on public.category_rules for select using (auth.uid() = user_id);
drop policy if exists "category_rules_insert_own" on public.category_rules;
create policy "category_rules_insert_own" on public.category_rules for insert with check (auth.uid() = user_id);
drop policy if exists "category_rules_update_own" on public.category_rules;
create policy "category_rules_update_own" on public.category_rules for update using (auth.uid() = user_id);
drop policy if exists "category_rules_delete_own" on public.category_rules;
create policy "category_rules_delete_own" on public.category_rules for delete using (auth.uid() = user_id);


-- =========================================================================
-- 15. CATEGORIAS PRÉ-DEFINIDAS (seed automático por utilizador)
-- =========================================================================
create or replace function public.seed_default_categories(p_user_id uuid)
returns void language plpgsql as $$
begin
  insert into public.categories (user_id, name, kind, color, is_default) values
    -- Receitas
    (p_user_id, 'Salário',             'receita', '#3DDC97', true),
    (p_user_id, 'Freelance / Extra',   'receita', '#2FB380', true),
    (p_user_id, 'Dividendos',          'receita', '#4C9AFF', true),
    (p_user_id, 'Reembolsos',          'receita', '#63C7B2', true),
    (p_user_id, 'Presentes Recebidos', 'receita', '#8FD9C4', true),
    (p_user_id, 'Outros Rendimentos',  'receita', '#8B93A1', true),

    -- Casa e contas fixas
    (p_user_id, 'Renda / Prestação Casa', 'despesa', '#9B7EDE', true),
    (p_user_id, 'Condomínio',             'despesa', '#A98CE0', true),
    (p_user_id, 'Eletricidade',           'despesa', '#D9A441', true),
    (p_user_id, 'Água',                   'despesa', '#4FB6D9', true),
    (p_user_id, 'Gás',                    'despesa', '#E08A3C', true),
    (p_user_id, 'Internet / TV',          'despesa', '#7C8CF8', true),
    (p_user_id, 'Telemóvel',              'despesa', '#6E7BE0', true),
    (p_user_id, 'Manutenção da Casa',     'despesa', '#B69A78', true),

    -- Alimentação
    (p_user_id, 'Supermercado',        'despesa', '#E5484D', true),
    (p_user_id, 'Restaurantes',        'despesa', '#F0685E', true),
    (p_user_id, 'Cafés / Snacks',      'despesa', '#F58F86', true),

    -- Transportes
    (p_user_id, 'Combustível',         'despesa', '#D9A441', true),
    (p_user_id, 'Transportes Públicos','despesa', '#C98F2E', true),
    (p_user_id, 'Manutenção do Carro', 'despesa', '#B87F1E', true),
    (p_user_id, 'Portagens / Parque',  'despesa', '#DDB05A', true),
    (p_user_id, 'Seguro Automóvel',    'despesa', '#C79A4A', true),

    -- Saúde e bem-estar
    (p_user_id, 'Farmácia',            'despesa', '#F2789F', true),
    (p_user_id, 'Médico / Consultas',  'despesa', '#EE5A88', true),
    (p_user_id, 'Ginásio / Desporto',  'despesa', '#F79CB7', true),
    (p_user_id, 'Seguro de Saúde',     'despesa', '#E56E97', true),

    -- Educação e desenvolvimento
    (p_user_id, 'Educação / Cursos',   'despesa', '#5B8DEF', true),
    (p_user_id, 'Livros',              'despesa', '#7FA6F5', true),

    -- Lazer e estilo de vida
    (p_user_id, 'Lazer / Entretenimento', 'despesa', '#5EC8D8', true),
    (p_user_id, 'Viagens / Férias',       'despesa', '#4AB0C2', true),
    (p_user_id, 'Subscrições (Streaming, Apps)', 'despesa', '#7C8CF8', true),
    (p_user_id, 'Roupa / Calçado',        'despesa', '#F2B84B', true),
    (p_user_id, 'Compras Diversas',       'despesa', '#F0A82E', true),
    (p_user_id, 'Presentes Dados',        'despesa', '#F5C97A', true),
    (p_user_id, 'Animais de Estimação',   'despesa', '#8FBF6B', true),

    -- Finanças e obrigações
    (p_user_id, 'Impostos',            'despesa', '#B0525C', true),
    (p_user_id, 'Comissões Bancárias', 'despesa', '#9C6B6F', true),
    (p_user_id, 'Seguros (Outros)',    'despesa', '#A87A82', true),
    (p_user_id, 'Poupança / Investimento', 'despesa', '#3DDC97', true),

    (p_user_id, 'Outros',              'despesa', '#8B93A1', true)
  on conflict (user_id, name, kind) do nothing;

  insert into public.categories (user_id, name, kind, color, is_default, exclude_from_reports) values
    (p_user_id, 'Ajuste de Saldo', 'receita', '#57616F', true, true),
    (p_user_id, 'Ajuste de Saldo', 'despesa', '#57616F', true, true)
  on conflict (user_id, name, kind) do update set exclude_from_reports = true;

  update public.categories
  set is_fee = true
  where user_id = p_user_id and name = 'Comissões Bancárias' and kind = 'despesa';
end;
$$;

-- =========================================================================
-- FIM
-- =========================================================================