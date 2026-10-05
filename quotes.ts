import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

/**
 * Cotações via Yahoo Finance, alinhadas com a bolsa que a DEGIRO usa.
 *
 * Problema original: o mesmo ISIN é negociado em várias bolsas e moedas
 * (ex: VWCE em Xetra, Amesterdão e Milão; ações US em USD). Pesquisar só por
 * ISIN devolvia uma listagem qualquer e o preço era tratado como EUR.
 *
 * Agora:
 *   1. A bolsa de referência da DEGIRO (EAM, XET, NDQ...) é convertida para
 *      o código de bolsa do Yahoo e escolhemos a listagem dessa bolsa.
 *   2. O preço é convertido para EUR (a DEGIRO mostra tudo em EUR).
 *   3. Guardamos o fecho anterior para calcular a variação do dia.
 */

/** Código de bolsa da DEGIRO -> códigos de bolsa equivalentes no Yahoo. */
const DEGIRO_TO_YAHOO_EXCHANGE: Record<string, string[]> = {
  EAM: ["AMS"],
  XET: ["GER"],
  TDG: ["GER"],
  FRA: ["FRA"],
  EPA: ["PAR"],
  MIL: ["MIL"],
  LSE: ["LSE"],
  EBR: ["BRU"],
  ELI: ["LIS"],
  MAD: ["MCE"],
  SWX: ["EBS"],
  CPH: ["CPH"],
  STO: ["STO"],
  HEL: ["HEL"],
  OSL: ["OSL"],
  VIE: ["VIE"],
  NDQ: ["NMS", "NGM", "NCM"],
  NSY: ["NYQ", "PCX", "ASE", "BTS"],
  ASE: ["ASE", "PCX"],
};

/** Quando não sabemos a bolsa, preferimos listagens europeias em EUR. */
const FALLBACK_PRIORITY = ["AMS", "GER", "PAR", "MIL", "LIS", "MCE", "BRU", "NMS", "NYQ", "LSE"];

export interface ResolvedSymbol {
  symbol: string;
  shortname?: string;
  exchange?: string;
}

export async function resolveSymbolFromIsin(
  isinOrName: string,
  degiroExchange?: string | null
): Promise<ResolvedSymbol | null> {
  try {
    const result = await yahooFinance.search(isinOrName, { quotesCount: 15 });
    const candidates = (result.quotes ?? []).filter(
      (q): q is typeof q & { symbol: string; exchange?: string } =>
        "symbol" in q && typeof q.symbol === "string" && q.symbol.length > 0
    );
    if (candidates.length === 0) return null;

    const exchangeOf = (q: { exchange?: unknown }) => (typeof q.exchange === "string" ? q.exchange : "");

    let best: (typeof candidates)[number] | undefined;

    const wanted = degiroExchange ? DEGIRO_TO_YAHOO_EXCHANGE[degiroExchange.trim().toUpperCase()] : undefined;
    if (wanted) {
      best = candidates.find((q) => wanted.includes(exchangeOf(q)));
    }
    if (!best) {
      best = [...candidates].sort((a, b) => {
        const ia = FALLBACK_PRIORITY.indexOf(exchangeOf(a));
        const ib = FALLBACK_PRIORITY.indexOf(exchangeOf(b));
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })[0];
    }
    if (!best) return null;

    return {
      symbol: best.symbol,
      shortname: "shortname" in best && typeof best.shortname === "string" ? best.shortname : undefined,
      exchange: exchangeOf(best) || undefined,
    };
  } catch (err) {
    console.error(`Falha ao resolver símbolo para "${isinOrName}":`, err);
    return null;
  }
}

export interface LiveQuote {
  symbol: string;
  /** Preço na moeda original da listagem (GBp já convertido para GBP). */
  price: number;
  currency: string;
  /** Preço convertido para EUR (null se não foi possível obter o câmbio). */
  priceEur: number | null;
  previousCloseEur: number | null;
  /** Variação do dia em %, ex: 1.53 significa +1,53%. */
  changePercent: number | null;
  marketState: string | null;
}

/** Câmbio moeda -> EUR, com cache partilhado durante um pedido. */
async function getFxToEur(currency: string, cache: Map<string, number | null>): Promise<number | null> {
  if (currency === "EUR") return 1;
  if (cache.has(currency)) return cache.get(currency) ?? null;
  try {
    const fx = await yahooFinance.quote(`${currency}EUR=X`);
    const rate = fx?.regularMarketPrice ?? null;
    cache.set(currency, rate);
    return rate;
  } catch (err) {
    console.error(`Falha ao obter câmbio ${currency}/EUR:`, err);
    cache.set(currency, null);
    return null;
  }
}

export async function getQuote(
  symbol: string,
  fxCache: Map<string, number | null> = new Map()
): Promise<LiveQuote | null> {
  try {
    const q = await yahooFinance.quote(symbol);
    if (!q || q.regularMarketPrice === undefined) return null;

    // Londres cota em pence (GBp): dividir por 100 para libras.
    let currency = q.currency ?? "EUR";
    let divisor = 1;
    if (currency === "GBp" || currency === "GBX") {
      currency = "GBP";
      divisor = 100;
    }

    const price = q.regularMarketPrice / divisor;
    const prev = q.regularMarketPreviousClose !== undefined ? q.regularMarketPreviousClose / divisor : null;
    const fx = await getFxToEur(currency, fxCache);

    return {
      symbol,
      price,
      currency,
      priceEur: fx !== null ? price * fx : null,
      previousCloseEur: fx !== null && prev !== null ? prev * fx : null,
      changePercent: q.regularMarketChangePercent ?? null,
      marketState: q.marketState ?? null,
    };
  } catch (err) {
    console.error(`Falha ao obter cotação para "${symbol}":`, err);
    return null;
  }
}
