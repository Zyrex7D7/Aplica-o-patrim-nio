-- =========================================================================
-- Correção do build: campos que o front-end já espera
-- (exclude_from_reports, total_fees, first_purchase_at)
-- =========================================================================
-- Idempotente. Corre no SQL Editor da Supabase, depois de schema.sql e
-- 002_melhorias.sql.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Categorias "ajuste" — ficam de fora dos totais de receitas/despesas
--    nos relatórios e no agrupamento mensal de transacoes/page.tsx (ex:
--    correções de saldo, movimentos internos que não são gasto real).
-- -------------------------------------------------------------------------
alter table public.categories
  add column if not exists exclude_from_reports boolean not null default false;

-- -------------------------------------------------------------------------
-- 2. portfolio_positions — acrescenta total_fees (comissões pagas nesse
--    ativo, embutidas nas compras/vendas OU como linha avulsa tipo
--    "custos de conectividade") e first_purchase_at (data da 1ª compra,
--    para a coluna "Desde" da tabela de posições).
-- -------------------------------------------------------------------------
-- "create or replace view" recusa-se a mudar a estrutura de colunas de uma
-- view já existente com um formato diferente — apaga-se e recria-se do
-- zero, o que é seguro (nada tem uma foreign key para uma view).
drop view if exists public.portfolio_positions;

create view public.portfolio_positions as
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
  -- Soma as comissões já embutidas nas linhas de compra/venda (coluna
  -- "fees") com as linhas de comissão avulsa (operation = 'comissao',
  -- típicas do extrato "Estado de Conta" — custos de conectividade, etc.).
  coalesce(sum(coalesce(at.fees, 0)), 0)
    + coalesce(sum(case when at.operation = 'comissao' then abs(at.total_value) else 0 end), 0)
    as total_fees,
  min(case when at.operation = 'compra' then coalesce(at.occurred_at, at.occurred_on::timestamptz) end)
    as first_purchase_at
from public.asset_transactions at
join public.assets ass on ass.id = at.asset_id
group by at.user_id, at.asset_id, ass.name, ass.symbol, ass.isin, ass.currency;
