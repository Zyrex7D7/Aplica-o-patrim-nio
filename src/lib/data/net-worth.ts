import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, PortfolioPosition } from "@/types/database";

export interface NetWorthBreakdown {
  totalNetWorth: number;
  cashInBanks: number;
  cashInBrokers: number;
  physicalCash: number;
  portfolioValue: number;
  portfolioCost: number;
  portfolioPnl: number;
  accounts: Account[];
  positions: (PortfolioPosition & { currentPrice: number | null; marketValue: number })[];
}

/**
 * Agrega, num único objeto, tudo o que o Dashboard de Património precisa:
 * saldos das contas (banco / corretora / numerário) + valor atual do
 * portefólio de investimentos, usando o cache de cotações `asset_quotes`.
 */
export async function getNetWorthBreakdown(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<NetWorthBreakdown> {
  const [{ data: accounts }, { data: positions }, { data: quotes }] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", userId).eq("is_archived", false),
    supabase.from("portfolio_positions").select("*").eq("user_id", userId),
    supabase.from("asset_quotes").select("*"),
  ]);

  const quoteByAsset = new Map((quotes ?? []).map((q: { asset_id: string; price: number }) => [q.asset_id, q.price]));

  const activePositions = (positions ?? []).filter((p: PortfolioPosition) => p.quantity_held > 0.0000001);

  const enrichedPositions = activePositions.map((p: PortfolioPosition) => {
    const currentPrice = quoteByAsset.get(p.asset_id) ?? null;
    const marketValue = currentPrice !== null ? currentPrice * p.quantity_held : p.net_invested;
    return { ...p, currentPrice, marketValue };
  });

  const portfolioValue = enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const portfolioCost = activePositions.reduce((sum: number, p: PortfolioPosition) => sum + p.net_invested, 0);

  const accountsList: Account[] = accounts ?? [];
  const cashInBanks = accountsList
    .filter((a) => a.type === "banco")
    .reduce((sum, a) => sum + Number(a.current_balance), 0);
  const cashInBrokers = accountsList
    .filter((a) => a.type === "corretora")
    .reduce((sum, a) => sum + Number(a.current_balance), 0);
  const physicalCash = accountsList
    .filter((a) => a.type === "numerario")
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  const totalNetWorth = cashInBanks + cashInBrokers + physicalCash + portfolioValue;

  return {
    totalNetWorth,
    cashInBanks,
    cashInBrokers,
    physicalCash,
    portfolioValue,
    portfolioCost,
    portfolioPnl: portfolioValue - portfolioCost,
    accounts: accountsList,
    positions: enrichedPositions,
  };
}
