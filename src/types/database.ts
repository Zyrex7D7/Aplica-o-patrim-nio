// Tipos manuais que espelham supabase/schema.sql.
// Para gerar automaticamente a partir do teu projeto real, corre:
//   npx supabase gen types typescript --project-id <ID> > src/types/database.ts

export type AccountType = "banco" | "corretora" | "numerario" | "poupanca";
export type CategoryKind = "receita" | "despesa";
export type TransactionType = "receita" | "despesa" | "transferencia";
export type AssetOperation = "compra" | "venda" | "dividendo" | "comissao" | "outro";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  institution: string | null;
  opening_balance: number;
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
  symbol: string | null;
  name: string;
  currency: string;
  created_at: string;
}

export interface AssetTransaction {
  id: string;
  user_id: string;
  account_id: string;
  asset_id: string;
  operation: AssetOperation;
  occurred_on: string;
  occurred_at: string | null;
  quantity: number | null;
  price: number | null;
  local_value: number | null;
  fees: number | null;
  total_value: number;
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
  price: number;
  currency: string;
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
  net_invested: number;
  total_dividends: number;
}

// Tipo mínimo compatível com o genérico esperado por @supabase/ssr.
// Substitui por `supabase gen types` quando ligares a um projeto real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
