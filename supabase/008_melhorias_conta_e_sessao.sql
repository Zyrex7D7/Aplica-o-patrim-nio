-- =========================================================================
-- 008 — Apagar contas com segurança + data da última sessão das cotações
-- =========================================================================
-- 1) asset_quotes.market_time: hora do último preço de mercado (a "sessão" a que
--    a variação diária diz respeito — com o mercado fechado é a da última sexta, etc.).
-- 2) delete_account(): apaga uma conta numa só transação, SEM falhar por causa de
--    transferências ligadas a ela (o CHECK das transferências impedia o delete simples).
--    Transferências que ENTRAVAM na conta apagada passam a despesas na conta de origem
--    (o dinheiro continua a ter saído de lá, por isso o saldo dessa conta não muda).
-- Idempotente.
-- =========================================================================

alter table public.asset_quotes add column if not exists market_time timestamptz;

create or replace function public.delete_account(p_account_id uuid)
returns jsonb language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_tx integer;
  v_atx integer;
begin
  if v_user is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;

  select name into v_name from public.accounts where id = p_account_id and user_id = v_user;
  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;

  -- transferências RECEBIDAS por esta conta => despesas na conta de origem
  update public.transactions
  set type = 'despesa',
      transfer_account_id = null,
      category_id = null,
      description = trim(both ' ' from coalesce(description, '') || ' (transferência para a conta apagada "' || v_name || '")')
  where user_id = v_user and transfer_account_id = p_account_id;

  update public.recurring_transactions
  set type = 'despesa',
      transfer_account_id = null,
      category_id = null,
      description = trim(both ' ' from coalesce(description, '') || ' (transferência para a conta apagada "' || v_name || '")')
  where user_id = v_user and transfer_account_id = p_account_id;

  select count(*) into v_tx  from public.transactions       where account_id = p_account_id;
  select count(*) into v_atx from public.asset_transactions where account_id = p_account_id;

  -- cascade: movimentos, transações de bolsa e recorrências DESTA conta
  delete from public.accounts where id = p_account_id and user_id = v_user;

  return jsonb_build_object('name', v_name, 'transactions', v_tx, 'asset_transactions', v_atx);
end;
$$;

revoke execute on function public.delete_account(uuid) from public, anon;
grant  execute on function public.delete_account(uuid) to authenticated;
