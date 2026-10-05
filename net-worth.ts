import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, PortfolioPosition } from "@/types/database";

export type EnrichedPosition = PortfolioPosition & {
  /** Preço atual em EUR (null se ainda não houver cotação). */
  currentPrice: number | null;
  marketValue: number;
  /** Variação do dia em fração (0.0153 = +1,53%), null se não houver fecho anterior. */
  dayChangePct: number | null;
  /** Variação do dia em EUR para a quantidade detida. */
  dayChangeEur: number | null;
};

export interface NetWorthBreakdown {
  totalNetWorth: number;
  cashInBanks: number;
  cashInSavings: number;
  cashInBrokers: number;
  physicalCash: number;
  portfolioValue: number;
  portfolioCost: number;
  portfolioPnl: number;
  /** Soma dos dividendos recebidos em todas as posições. */
  totalDividends: number;
  /** Variação do dia do portefólio inteiro, em EUR e em fração. */
  dayChangeEur: number;
  dayChangePct: number;
  /** Momento da cotação mais recente, ou null se nunca foram atualizadas. */
  lastQuoteAt: string | null;
  accounts: Account[];
  positions: EnrichedPosition[];
}

interface QuoteRow {
  asset_id: string;
  price: number;
  currency: string;
  price_eur: number | null;
  previous_close_eur: number | null;
  fetched_at: string;
}

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

  const quoteByAsset = new Map<string, QuoteRow>((quotes ?? []).map((q: QuoteRow) => [q.asset_id, q]));

  const activePositions = (positions ?? []).filter((p: PortfolioPosition) => p.quantity_held > 0.0000001);

  const enrichedPositions: EnrichedPosition[] = activePositions.map((p: PortfolioPosition) => {
    const q = quoteByAsset.get(p.asset_id);
    // Preço em EUR: o convertido, ou o preço original se a moeda já for EUR.
    const priceEur = q ? q.price_eur ?? (q.currency === "EUR" ? Number(q.price) : null) : null;
    const prevEur = q?.previous_close_eur ?? null;

    const marketValue = priceEur !== null ? priceEur * p.quantity_held : p.net_invested;
    const dayChangeEur =
      priceEur !== null && prevEur !== null ? (priceEur - Number(prevEur)) * p.quantity_held : null;
    const dayChangePct =
      priceEur !== null && prevEur !== null && Number(prevEur) !== 0 ? priceEur / Number(prevEur) - 1 : null;

    return { ...p, currentPrice: priceEur, marketValue, dayChangePct, dayChangeEur };
  });

  const portfolioValue = enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const portfolioCost = activePositions.reduce((sum: number, p: PortfolioPosition) => sum + p.net_invested, 0);
  const totalDividends = enrichedPositions.reduce((sum, p) => sum + Number(p.total_dividends), 0);

  const dayChangeEur = enrichedPositions.reduce((sum, p) => sum + (p.dayChangeEur ?? 0), 0);
  const valueYesterday = portfolioValue - dayChangeEur;
  const dayChangePct = valueYesterday !== 0 ? dayChangeEur / valueYesterday : 0;

  const lastQuoteAt =
    (quotes ?? []).reduce<string | null>(
      (latest, q: QuoteRow) => (!latest || q.fetched_at > latest ? q.fetched_at : latest),
      null
    ) ?? null;

  const accountsList: Account[] = accounts ?? [];
  const sumBy = (type: Account["type"]) =>
    accountsList.filter((a) => a.type === type).reduce((sum, a) => sum + Number(a.current_balance), 0);

  const cashInBanks = sumBy("banco");
  const cashInSavings = sumBy("poupanca");
  const cashInBrokers = sumBy("corretora");
  const physicalCash = sumBy("numerario");

  return {
    totalNetWorth: cashInBanks + cashInSavings + cashInBrokers + physicalCash + portfolioValue,
    cashInBanks,
    cashInSavings,
    cashInBrokers,
    physicalCash,
    portfolioValue,
    portfolioCost,
    portfolioPnl: portfolioValue - portfolioCost,
    totalDividends,
    dayChangeEur,
    dayChangePct,
    lastQuoteAt,
    accounts: accountsList,
    positions: enrichedPositions,
  };
}
