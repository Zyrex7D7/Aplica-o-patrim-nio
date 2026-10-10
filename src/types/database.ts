// Tipos manuais que espelham supabase/schema.sql + migrações 002 a 007.
// Para gerar automaticamente a partir do teu projeto real, corre:
//   npx supabase gen types typescript --project-id <ID> > src/types/database.ts
// (e depois troca o `Database = any` do fim do ficheiro pelo tipo gerado).

export type AccountType = "banco" | "corretora" | "numerario" | "poupanca";
export type CategoryKind = "receita" | "despesa";
export type TransactionType = "receita" | "despesa" | "transferencia";
export type AssetOperation = "compra" | "venda" | "dividendo" | "comissao" | "outro";
export type RecurrenceFrequency = "diaria" | "semanal" | "mensal" | "anual";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  institution: string | null;
  opening_balance: number;
  /** Saldo reportado pela DEGIRO na última importação (ponto de reconciliação). */
  reconciled_balance: number | null;
  reconciled_at: string | null;
  current_balance: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: CategoryKind;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  /** Categorias "ajuste" — ficam de fora dos totais de receitas/despesas nos relatórios. */
  exclude_from_reports: boolean;
  /** Marca esta categoria como representando uma comissão/taxa (ex: "Comissões Bancárias"). */
  is_fee: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  occurred_on: string;
  account_id: string;
  transfer_account_id: string | null;
  category_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  isin: string | null;
  /** Símbolo Yahoo Finance da listagem escolhida (ex: "SXR8.DE"). */
  symbol: string | null;
  /** Bolsa de referência da DEGIRO (EAM, XET, NDQ...), quando o CSV a traz. */
  exchange: string | null;
  /** Quando o símbolo foi descoberto pela última vez. */
  symbol_resolved_at: string | null;
  name: string;
  currency: string;
  created_at: string;
}

export interface AssetTransaction {
  id: string;
  user_id: string;
  account_id: string;
  asset_id: string;
  import_id: string | null;
  operation: AssetOperation;
  occurred_on: string;
  occurred_at: string | null;
  quantity: number | null;
  price: number | null;
  local_value: number | null;
  fees: number | null;
  /** Fluxo de caixa em EUR, COM SINAL (compra < 0, venda > 0). */
  total_value: number;
  /** Moeda original da operação (o total_value já está convertido para EUR). */
  currency: string | null;
  exchange_rate: number | null;
  description: string | null;
  order_id: string | null;
  source_hash: string;
  source: string;
  raw_row: Record<string, string> | null;
  created_at: string;
}

export interface AssetQuote {
  asset_id: string;
  /** Preço na moeda da listagem. */
  price: number;
  currency: string;
  /** Preço convertido para EUR. */
  price_eur: number | null;
  previous_close_eur: number | null;
  /** Variação do dia em %, ex: 1.53 = +1,53%. */
  change_percent: number | null;
  fetched_at: string;
}

export interface CsvImport {
  id: string;
  user_id: string;
  account_id: string | null;
  file_name: string;
  file_hash: string;
  rows_total: number;
  rows_inserted: number;
  rows_duplicated: number;
  rows_failed: number;
  /** Saldo reportado pela DEGIRO neste ficheiro (usado para repor a reconciliação ao desfazer). */
  balance: number | null;
  balance_at: string | null;
  created_at: string;
}

export interface PortfolioPosition {
  user_id: string;
  asset_id: string;
  name: string;
  symbol: string | null;
  isin: string | null;
  currency: string;
  quantity_held: number;
  /** Custo das unidades que AINDA tens (média ponderada das compras × quantidade). */
  net_invested: number;
  total_dividends: number;
  /** Comissões pagas neste ativo (embutidas nas compras/vendas + linhas avulsas). */
  total_fees: number;
  /** Data da primeira compra deste ativo, ou null se nunca houve uma. */
  first_purchase_at: string | null;
  trade_count: number;
}

export interface NetWorthSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  total_net_worth: number;
  cash_in_banks: number;
  cash_in_savings: number;
  cash_in_brokers: number;
  physical_cash: number;
  portfolio_value: number;
  portfolio_cost: number;
  created_at: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  account_id: string;
  transfer_account_id: string | null;
  category_id: string | null;
  description: string | null;
  frequency: RecurrenceFrequency;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_occurrence: string;
  is_active: boolean;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  monthly_limit: number;
  created_at: string;
}

export interface BudgetStatus {
  user_id: string;
  category_id: string;
  category_name: string;
  category_color: string | null;
  monthly_limit: number;
  spent_this_month: number;
}

export interface RealizedPnlRow {
  asset_id: string;
  realized_pnl: number;
}

/** Regra de categorização automática: se `keyword` aparecer na descrição, sugere `category_id`. */
export interface CategoryRule {
  id: string;
  user_id: string;
  keyword: string;
  category_id: string;
  priority: number;
  created_at: string;
}

/** Ativo em observação no Radar. */
export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  currency: string;
  added_price: number | null;
  added_at: string;
}

/** Uma linha por chamada: `get_fees_summary` devolve `FeesSummary[]` (usa o primeiro elemento). */
export interface FeesSummary {
  banking_fees: number;
  investment_fees: number;
  total_fees: number;
}

export interface FeeTransactionRow {
  occurred_on: string;
  source: "Bancária" | "Investimento" | "Investimento (embutida)";
  description: string;
  amount: number;
}

// Tipo mínimo compatível com o genérico esperado por @supabase/ssr.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
