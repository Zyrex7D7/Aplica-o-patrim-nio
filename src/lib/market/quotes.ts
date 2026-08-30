import YahooFinance from "yahoo-finance2";

// Na v4 do yahoo-finance2, o export por omissão é uma classe — precisa de
// ser instanciada uma única vez e reutilizada entre pedidos.
const yahooFinance = new YahooFinance();

/**
 * Módulo de cotações em tempo (quase) real via `yahoo-finance2`.
 *
 * A DEGIRO identifica os ativos por ISIN, mas o Yahoo Finance funciona por
 * "ticker" (símbolo). Por isso:
 *   1. `resolveSymbolFromIsin` usa a pesquisa do Yahoo para encontrar o
 *      símbolo mais provável a partir do ISIN ou do nome do produto.
 *   2. `getQuote` devolve o preço atual + moeda para um símbolo já
 *      conhecido, para atualizar o valor do portefólio e o P/L.
 */

export interface ResolvedSymbol {
  symbol: string;
  shortname?: string;
  exchange?: string;
  currency?: string;
}

export async function resolveSymbolFromIsin(
  isinOrName: string
): Promise<ResolvedSymbol | null> {
  try {
    const result = await yahooFinance.search(isinOrName, { quotesCount: 5 });
    const best = result.quotes?.find(
      (q): q is typeof q & { symbol: string } =>
        "symbol" in q && typeof q.symbol === "string" && q.symbol.length > 0
    );
    if (!best) return null;
    return {
      symbol: best.symbol,
      shortname: "shortname" in best && typeof best.shortname === "string" ? best.shortname : undefined,
      exchange: "exchange" in best && typeof best.exchange === "string" ? best.exchange : undefined,
    };
  } catch (err) {
    console.error(`Falha ao resolver símbolo para "${isinOrName}":`, err);
    return null;
  }
}

export interface LiveQuote {
  symbol: string;
  price: number;
  currency: string;
  changePercent: number | null;
  marketState: string | null;
}

export async function getQuote(symbol: string): Promise<LiveQuote | null> {
  try {
    const q = await yahooFinance.quote(symbol);
    if (!q || q.regularMarketPrice === undefined) return null;
    return {
      symbol,
      price: q.regularMarketPrice,
      currency: q.currency ?? "EUR",
      changePercent: q.regularMarketChangePercent ?? null,
      marketState: q.marketState ?? null,
    };
  } catch (err) {
    console.error(`Falha ao obter cotação para "${symbol}":`, err);
    return null;
  }
}

export async function getQuotes(symbols: string[]): Promise<LiveQuote[]> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const results = await Promise.allSettled(unique.map((s) => getQuote(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<LiveQuote | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is LiveQuote => v !== null);
}
