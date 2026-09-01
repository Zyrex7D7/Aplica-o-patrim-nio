-- =========================================================================
-- Liga cada transação de bolsa à importação DEGIRO que a criou.
-- =========================================================================
-- Com "on delete cascade", apagar a linha em csv_imports apaga
-- automaticamente todas as asset_transactions que essa importação trouxe —
-- sem isto não havia como saber quais linhas pertenciam a qual ficheiro,
-- por isso não dava para desfazer uma importação específica.
--
-- Idempotente. Corre no SQL Editor da Supabase, depois de schema.sql e
-- 003_correcoes_build.sql.
-- =========================================================================

alter table public.asset_transactions
  add column if not exists import_id uuid references public.csv_imports(id) on delete cascade;

create index if not exists idx_asset_tx_import on public.asset_transactions(import_id);
