-- =========================================================================
-- 004: Categorização automática + Comissões e Taxas
-- =========================================================================
-- Idempotente. Corre no SQL Editor da Supabase, depois de schema.sql,
-- 002_melhorias.sql e 003_correcoes_build.sql.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. REGRAS DE CATEGORIZAÇÃO AUTOMÁTICA
-- -------------------------------------------------------------------------
-- Cada regra associa uma palavra-chave a uma categoria. Quando o utilizador
-- escreve a descrição de um movimento, procuramos (no lado do cliente, via
-- RPC) se alguma palavra-chave das suas regras aparece no texto e sugerimos
-- essa categoria automaticamente.
create table if not exists public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  keyword     text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  priority    integer not null default 0,  -- regras com prioridade maior ganham em caso de empate
  created_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

create index if not exists idx_category_rules_user on public.category_rules(user_id);

alter table public.category_rules enable row level security;

drop policy if exists "category_rules_select_own" on public.category_rules;
create policy "category_rules_select_own" on public.category_rules for select using (auth.uid() = user_id);
drop policy if exists "category_rules_insert_own" on public.category_rules;
create policy "category_rules_insert_own" on public.category_rules for insert with check (auth.uid() = user_id);
drop policy if exists "category_rules_update_own" on public.category_rules;
create policy "category_rules_update_own" on public.category_rules for update using (auth.uid() = user_id);
drop policy if exists "category_rules_delete_own" on public.category_rules;
create policy "category_rules_delete_own" on public.category_rules for delete using (auth.uid() = user_id);

-- Sugere uma categoria a partir do texto de descrição, procurando a
-- palavra-chave mais longa (mais específica) que aparece no texto; em caso
-- de empate no comprimento, ganha a de maior "priority".
create or replace function public.suggest_category(p_user_id uuid, p_description text)
returns uuid
language sql
stable
as $$
  select cr.category_id
  from public.category_rules cr
  where cr.user_id = p_user_id
    and p_description is not null
    and position(lower(cr.keyword) in lower(p_description)) > 0
  order by length(cr.keyword) desc, cr.priority desc
  limit 1;
$$;

-- -------------------------------------------------------------------------
-- 2. COMISSÕES E TAXAS
-- -------------------------------------------------------------------------
-- Marca categorias de orçamento (não-investimento) como representando
-- comissões/taxas (ex: "Comissões Bancárias"), para as podermos somar à
-- parte à parte das comissões de bolsa (que já vivem em asset_transactions).
alter table public.categories add column if not exists is_fee boolean not null default false;

-- Marca a categoria por omissão já existente como sendo uma taxa.
update public.categories set is_fee = true where name = 'Comissões Bancárias' and kind = 'despesa';

-- Resumo agregado: comissões bancárias (orçamento) + comissões de
-- investimento (compras/vendas/comissões avulsas na DEGIRO), a partir de
-- uma data opcional (por omissão, desde sempre).
create or replace function public.get_fees_summary(p_user_id uuid, p_from date default '1900-01-01')
returns table(banking_fees numeric, investment_fees numeric, total_fees numeric)
language sql
stable
as $$
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

-- Lista detalhada das linhas que compõem as comissões/taxas, para o
-- utilizador poder ver exatamente de onde vem o total (em vez de só um
-- número agregado).
create or replace function public.get_fee_transactions(p_user_id uuid, p_from date default '1900-01-01')
returns table(occurred_on date, source text, description text, amount numeric)
language sql
stable
as $$
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
