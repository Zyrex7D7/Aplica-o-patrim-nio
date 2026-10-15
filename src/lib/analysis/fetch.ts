import YahooFinance from "yahoo-finance2";
import type { RawFundamentals, YearData } from "./types";

const yahooFinance = new YahooFinance();

function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Yahoo Finance: sem resposta a tempo")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await withTimeout(fn());
  } catch (err) {
    console.error(`Análise: falhou ${label}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

type Row = Record<string, unknown>;
const num = (x: unknown): number | undefined => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
const str = (x: unknown): string | null => (typeof x === "string" && x.length > 0 ? x : null);
/** Valor que o Yahoo por vezes embrulha em { raw, fmt }. */
const val = (x: unknown): number | null => {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (x && typeof x === "object" && "raw" in x) return val((x as { raw: unknown }).raw);
  return null;
};

/** Campo de uma linha, aceitando o nome simples ("totalRevenue") ou com prefixo ("annualTotalRevenue"). */
function pick(row: Row, ...names: string[]): number | undefined {
  for (const n of names) {
    const direct = num(row[n]);
    if (direct !== undefined) return direct;
    const prefixed = num(row[`annual${n.charAt(0).toUpperCase()}${n.slice(1)}`]);
    if (prefixed !== undefined) return prefixed;
  }
  return undefined;
}

function toIsoDate(d: unknown): string | null {
  const date = d instanceof Date ? d : typeof d === "number" ? new Date(d > 1e11 ? d : d * 1000) : typeof d === "string" ? new Date(d) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/**
 * Junta as linhas das 3 demonstrações (resultados, balanço, fluxos de caixa) por data de fecho
 * do exercício e devolve os anos por ordem crescente. Função pura (testável sem rede).
 */
export function mapStatementRows(...rowSets: (Row[] | null)[]): YearData[] {
  const byDate = new Map<string, Row>();
  for (const rows of rowSets) {
    for (const row of rows ?? []) {
      const date = toIsoDate(row.date);
      if (!date) continue;
      byDate.set(date, { ...(byDate.get(date) ?? {}), ...row });
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, r]): YearData => ({
      date,
      year: Number(date.slice(0, 4)),
      revenue: pick(r, "totalRevenue"),
      costOfRevenue: pick(r, "costOfRevenue"),
      grossProfit: pick(r, "grossProfit"),
      operatingIncome: pick(r, "operatingIncome"),
      ebit: pick(r, "EBIT"),
      ebitda: pick(r, "EBITDA", "normalizedEBITDA"),
      interestExpense: pick(r, "interestExpense"),
      netIncome: pick(r, "netIncome"),
      taxRate: pick(r, "taxRateForCalcs"),
      operatingCashFlow: pick(r, "operatingCashFlow"),
      capex: pick(r, "capitalExpenditure"),
      fcf: pick(r, "freeCashFlow"),
      dividendsPaid: pick(r, "commonStockDividendPaid"),
      buybacks: pick(r, "repurchaseOfCapitalStock"),
      totalAssets: pick(r, "totalAssets"),
      currentAssets: pick(r, "currentAssets"),
      currentLiabilities: pick(r, "currentLiabilities"),
      receivables: pick(r, "accountsReceivable"),
      inventory: pick(r, "inventory"),
      payables: pick(r, "accountsPayable"),
      cash: pick(r, "cashCashEquivalentsAndShortTermInvestments", "cashAndCashEquivalents"),
      totalDebt: pick(r, "totalDebt"),
      netDebt: pick(r, "netDebt"),
      equity: pick(r, "stockholdersEquity"),
      investedCapital: pick(r, "investedCapital"),
      shares: pick(r, "ordinarySharesNumber"),
    }))
    .slice(-6);
}

const MODULES = ["price", "summaryDetail", "defaultKeyStatistics", "financialData", "assetProfile"] as const;

/** Vai buscar ao Yahoo Finance tudo o que a análise precisa. Peças que falhem ficam vazias (a análise avisa). */
export async function fetchFundamentals(symbol: string): Promise<RawFundamentals> {
  const period1 = new Date(Date.now() - 6.5 * 365 * 86400000).toISOString().slice(0, 10);

  const [summary, fin, bal, cf] = await Promise.all([
    safe("resumo", () => yahooFinance.quoteSummary(symbol, { modules: [...MODULES] })),
    safe("resultados", () => yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "annual", module: "financials" })),
    safe("balanço", () => yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "annual", module: "balance-sheet" })),
    safe("fluxos de caixa", () => yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "annual", module: "cash-flow" })),
  ]);

  if (!summary) throw new Error("O Yahoo Finance não respondeu para este símbolo. Confirma o ticker ou tenta mais tarde.");

  const s = summary as unknown as Record<string, Row | undefined>;
  const price = s.price ?? {};
  const detail = s.summaryDetail ?? {};
  const stats = s.defaultKeyStatistics ?? {};
  const fd = s.financialData ?? {};
  const profile = s.assetProfile ?? {};

  let currency = str(price.currency) ?? "USD";
  let priceValue = val(price.regularMarketPrice) ?? val(fd.currentPrice);
  if (currency === "GBp" || currency === "GBX") {
    currency = "GBP";
    if (priceValue !== null) priceValue /= 100;
  }

  const financialCurrency = str(fd.financialCurrency);
  let fx: number | null = 1;
  if (financialCurrency && financialCurrency !== currency) {
    const q = await safe("câmbio", () => yahooFinance.quote(`${financialCurrency}${currency}=X`));
    fx = q?.regularMarketPrice ?? null;
  }

  return {
    symbol,
    name: str(price.longName) ?? str(price.shortName) ?? symbol,
    currency,
    quoteType: str(price.quoteType) ?? "EQUITY",
    price: priceValue,
    marketCap: val(price.marketCap) ?? val(detail.marketCap),
    sharesOutstanding: val(stats.sharesOutstanding),
    enterpriseValue: val(stats.enterpriseValue),
    beta: val(stats.beta) ?? val(detail.beta),
    pegRatio: val(stats.pegRatio),
    forwardPE: val(stats.forwardPE) ?? val(detail.forwardPE),
    trailingPE: val(detail.trailingPE),
    enterpriseToEbitda: val(stats.enterpriseToEbitda),
    sector: str(profile.sector),
    industry: str(profile.industry),
    insidersPercent: val(stats.heldPercentInsiders),
    targetMean: val(fd.targetMeanPrice),
    targetLow: val(fd.targetLowPrice),
    targetHigh: val(fd.targetHighPrice),
    analystCount: val(fd.numberOfAnalystOpinions),
    recommendation: str(fd.recommendationKey),
    earningsGrowth: val(fd.earningsGrowth),
    financialCurrency,
    fx,
    years: mapStatementRows(fin as unknown as Row[] | null, bal as unknown as Row[] | null, cf as unknown as Row[] | null),
  };
}

const cache = new Map<string, { at: number; raw: RawFundamentals }>();
const TTL_MS = 6 * 3600 * 1000;

/** Com cache de 6 horas: os fundamentos mudam de trimestre a trimestre, não de minuto a minuto. */
export async function fetchFundamentalsCached(symbol: string): Promise<RawFundamentals> {
  const key = symbol.toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.raw;
  const raw = await fetchFundamentals(symbol);
  // não guardar em cache respostas vazias (ex: Yahoo temporariamente sem dados)
  if (raw.years.length > 0 || raw.quoteType !== "EQUITY") cache.set(key, { at: Date.now(), raw });
  return raw;
}
