-- =========================================================================
-- Gestor de Património e Finanças Pessoais — Esquema Supabase (Postgres)
-- =========================================================================
-- Este script é idempotente (pode ser corrido várias vezes em segurança).
-- Corre isto no SQL Editor do teu projeto Supabase.
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. CONTAS (bancos, corretoras, numerário)
-- -------------------------------------------------------------------------
do $$ begin
  create type account_type as enum ('banco', 'corretora', 'numerario', 'poupanca');
exception when duplicate_object then null;
end $$;

-- Migração suave: se o enum já existir de uma instalação anterior sem o
-- valor 'poupanca', acrescenta-o agora. "IF NOT EXISTS" já torna isto
-- seguro por si só — não precisa (nem pode, de forma fiável) de estar
-- dentro de um bloco PL/pgSQL.
alter type account_type add value if not exists 'poupanca';

create table if not exists public.accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,                 -- ex: "Santander", "DEGIRO", "Carteira"
  type          account_type not null,
  currency      text not null default 'EUR',
  institution   text,                          -- ex: "Santander Totta", "DEGIRO B.V."
  opening_balance numeric(18,2) not null default 0,
  -- "Ponto de reconciliação": quando importamos um extrato da DEGIRO,
  -- confiamos no saldo que a PRÓPRIA DEGIRO reporta (coluna "Saldo") em vez
  -- de tentarmos recalcular tudo a partir das nossas transações — isso
  -- captura automaticamente depósitos, levantamentos, cash sweeps, juros,
  -- etc. que não modelamos individualmente. A partir deste ponto, só
  -- somamos movimentos (transactions/asset_transactions) que aconteçam
  -- DEPOIS de reconciled_at.
  reconciled_balance numeric(18,2),
  reconciled_at      timestamptz,
  -- saldo corrente é derivado (ver view account_balances), mas guardamos
  -- também um cache atualizado por trigger para leitura rápida no dashboard.
  current_balance numeric(18,2) not null default 0,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Migração suave para instalações já existentes (idempotente).
alter table public.accounts add column if not exists reconciled_balance numeric(18,2);
alter table public.accounts add column if not exists reconciled_at timestamptz;

create index if not exists idx_accounts_user on public.accounts(user_id);

-- -------------------------------------------------------------------------
-- 2. CATEGORIAS (personalizáveis, para receitas/despesas)
-- -------------------------------------------------------------------------
do $$ begin
  create type category_kind as enum ('receita', 'despesa');
exception when duplicate_object then null;
end $$;

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kind        category_kind not null,
  color       text default '#8B93A1',          -- para os gráficos
  icon        text,                             -- nome de ícone (lucide-react)
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, name, kind)
);

-- -------------------------------------------------------------------------
-- 3. TRANSAÇÕES FINANCEIRAS DIÁRIAS (orçamento: receitas / despesas / transferências)
-- -------------------------------------------------------------------------
do $$ begin
  create type transaction_type as enum ('receita', 'despesa', 'transferencia');
exception when duplicate_object then null;
end $$;

create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            transaction_type not null,
  amount          numeric(18,2) not null check (amount > 0),
  occurred_on     date not null,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  -- usado apenas quando type = 'transferencia' (conta de destino)
  transfer_account_id uuid references public.accounts(id) on delete set null,
  category_id     uuid references public.categories(id) on delete set null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (
    (type = 'transferencia' and transfer_account_id is not null and transfer_account_id <> account_id)
    or (type <> 'transferencia' and transfer_account_id is null)
  )
);

create index if not exists idx_transactions_user_date on public.transactions(user_id, occurred_on desc);
create index if not exists idx_transactions_account on public.transactions(account_id);
create index if not exists idx_transactions_category on public.transactions(category_id);

-- -------------------------------------------------------------------------
-- 4. ATIVOS (instrumentos financeiros — ações, ETFs, etc.)
-- -------------------------------------------------------------------------
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  isin        text unique,                       -- pode ser null p/ ativos sem ISIN
  symbol      text,                               -- ticker Yahoo Finance, ex: "VWCE.DE"
  name        text not null,
  currency    text not null default 'EUR',
  created_at  timestamptz not null default now()
);

create index if not exists idx_assets_isin on public.assets(isin);
create index if not exists idx_assets_symbol on public.assets(symbol);

-- -------------------------------------------------------------------------
-- 5. TRANSAÇÕES DE BOLSA (compras, vendas, dividendos, comissões — DEGIRO)
-- -------------------------------------------------------------------------
do $$ begin
  create type asset_operation as enum ('compra', 'venda', 'dividendo', 'comissao', 'outro');
exception when duplicate_object then null;
end $$;

create table if not exists public.asset_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  asset_id        uuid not null references public.assets(id) on delete cascade,
  operation       asset_operation not null,
  occurred_on     date not null,
  occurred_at     timestamptz,                     -- data+hora, se disponível no CSV
  quantity        numeric(18,6),                   -- null em dividendos/comissões avulsas
  price           numeric(18,6),                   -- preço unitário na moeda local do ativo
  local_value     numeric(18,2),                   -- valor na moeda local (coluna "Montante")
  fees            numeric(18,2) default 0,
  total_value     numeric(18,2) not null,           -- valor total em EUR (coluna "Total")
  currency        text default 'EUR',
  exchange_rate   numeric(18,6),
  description     text,                             -- texto original da coluna Descrição
  order_id        text,                              -- coluna "ID Ordem" da DEGIRO, se existir
  -- hash único da linha original do CSV -> previne duplicados em re-importações
  source_hash     text not null,
  source          text not null default 'degiro',
  raw_row         jsonb,                             -- guarda a linha original para auditoria
  created_at      timestamptz not null default now(),
  unique (user_id, source_hash)
);

create index if not exists idx_asset_tx_user_date on public.asset_transactions(user_id, occurred_on desc);
create index if not exists idx_asset_tx_asset on public.asset_transactions(asset_id);
create index if not exists idx_asset_tx_account on public.asset_transactions(account_id);

-- -------------------------------------------------------------------------
-- 6. COTAÇÕES (cache de preços atuais, para não bombardear a API a cada load)
-- -------------------------------------------------------------------------
create table if not exists public.asset_quotes (
  asset_id      uuid primary key references public.assets(id) on delete cascade,
  price         numeric(18,6) not null,
  currency      text not null default 'EUR',
  fetched_at    timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 7. IMPORTAÇÕES CSV (histórico/auditoria de uploads DEGIRO)
-- -------------------------------------------------------------------------
create table if not exists public.csv_imports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid references public.accounts(id) on delete set null,
  file_name       text not null,
  file_hash       text not null,               -- hash do ficheiro inteiro
  rows_total      integer not null default 0,
  rows_inserted   integer not null default 0,
  rows_duplicated integer not null default 0,
  rows_failed     integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (user_id, file_hash)
);

-- =========================================================================
-- VIEWS
-- =========================================================================

-- Saldo corrente de cada conta a partir das transações (fonte de verdade).
--
-- Ponto de partida: coalesce(reconciled_balance, opening_balance). Se a
-- conta tiver sido reconciliada (ex: por uma importação DEGIRO), só somamos
-- movimentos que aconteceram DEPOIS desse ponto — o saldo reconciliado já
-- inclui o efeito de tudo o que aconteceu até lá.
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

-- Posições atuais do portefólio (quantidade líquida por ativo e preço médio de custo).
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
  -- "total_value" já vem com o sinal do movimento de caixa (compra = saída,
  -- negativo; venda = entrada, positiva). Para chegar ao capital líquido
  -- investido (um valor positivo quando ainda há dinheiro "preso" na
  -- posição), invertemos o sinal em ambos os casos: uma compra de -1000€
  -- soma +1000€ ao investido; uma venda de +400€ soma -400€ (reduz o
  -- capital investido, porque já recebeste esse dinheiro de volta).
  sum(case when at.operation in ('compra', 'venda') then -at.total_value
           else 0 end) as net_invested,
  sum(case when at.operation = 'dividendo' then at.total_value else 0 end) as total_dividends
from public.asset_transactions at
join public.assets ass on ass.id = at.asset_id
group by at.user_id, at.asset_id, ass.name, ass.symbol, ass.isin, ass.currency;

-- =========================================================================
-- TRIGGERS: manter accounts.current_balance sincronizado (cache de leitura)
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

-- Fixa o saldo de uma conta a um valor conhecido num determinado instante
-- (ex: o saldo que a DEGIRO reportou na última linha de um extrato
-- importado). Só avança o ponto de reconciliação para a frente no tempo —
-- reimportar um ficheiro mais antigo nunca faz a conta "recuar".
create or replace function public.reconcile_account_balance(
  p_account_id uuid,
  p_balance numeric,
  p_at timestamptz
)
returns void language plpgsql as $$
begin
  update public.accounts
  set reconciled_balance = p_balance,
      reconciled_at = p_at
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
-- ROW LEVEL SECURITY
-- =========================================================================
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.asset_transactions enable row level security;
alter table public.csv_imports enable row level security;
alter table public.assets enable row level security;
alter table public.asset_quotes enable row level security;

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

-- assets & quotes: catálogo partilhado, leitura para todos os utilizadores autenticados
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

-- =========================================================================
-- CATEGORIAS PRÉ-DEFINIDAS (opcional: correr manualmente por utilizador,
-- ou chamar esta função depois do signup a partir de um trigger auth.users)
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
end;
$$;
