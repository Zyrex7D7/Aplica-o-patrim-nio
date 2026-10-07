import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

/**
 * Cotações via Yahoo Finance, alinhadas com a bolsa que a DEGIRO usa.
 *
 * - Cada ativo é identificado pelo ISIN; a listagem escolhida é a da mesma
 *   bolsa que a DEGIRO mostra (quando o CSV a traz) ou, na falta dela, a
 *   listagem europeia em EUR mais comum (Xetra primeiro).
 * - Preços convertidos para EUR (a DEGIRO mostra tudo em EUR).
 * - Fecho anterior guardado para calcular a variação do dia.
 */

/** Código de bolsa da DEGIRO -> códigos de bolsa equivalentes no Yahoo. */
const DEGIRO_TO_YAHOO_EXCHANGE: Record<string, string[]> = {
  EAM: ["AMS"],
  XET: ["GER"],
  TDG: ["GER"], // Tradegate não existe no Yahoo; Xetra é o mais próximo
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

const EU_PRIORITY = ["GER", "AMS", "PAR", "MIL", "LIS", "MCE", "BRU", "VIE", "HEL", "EBS", "LSE", "FRA", "STO", "CPH", "OSL"];
const US_PRIORITY = ["NMS", "NGM", "NCM", "NYQ", "PCX", "ASE", "BTS"];

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

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
    const result = await yahooFinance.search(isinOrName, { quotesCount: 20 });
    const candidates = (result.quotes ?? []).filter((q) => {
      if (!("symbol" in q) || typeof q.symbol !== "string" || q.symbol.length === 0) return false;
      const type = "quoteType" in q && typeof q.quoteType === "string" ? q.quoteType : "";
      return type === "" || ["EQUITY", "ETF", "MUTUALFUND"].includes(type);
    }) as unknown as { symbol: string; shortname?: string; exchange?: string }[];
    if (candidates.length === 0) return null;

    const exchangeOf = (q: { exchange?: unknown }) => (typeof q.exchange === "string" ? q.exchange : "");

    let best: (typeof candidates)[number] | undefined;

    // 1) A bolsa que a própria DEGIRO indica (CSV de Transações).
    const wanted = degiroExchange ? DEGIRO_TO_YAHOO_EXCHANGE[degiroExchange.trim().toUpperCase()] : undefined;
    if (wanted) best = candidates.find((q) => wanted.includes(exchangeOf(q)));

    // 2) Sem bolsa conhecida: ações dos EUA ficam nos EUA, o resto na Europa (Xetra primeiro).
    if (!best) {
      const priority = ISIN_RE.test(isinOrName) && isinOrName.startsWith("US")
        ? [...US_PRIORITY, ...EU_PRIORITY]
        : [...EU_PRIORITY, ...US_PRIORITY];
      best = [...candidates].sort((a, b) => {
        const ia = priority.indexOf(exchangeOf(a));
        const ib = priority.indexOf(exchangeOf(b));
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })[0];
    }
    if (!best) return null;

    return {
      symbol: best.symbol,
      shortname: typeof best.shortname === "string" ? best.shortname : undefined,
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

/** Câmbio atual moeda -> EUR, com cache partilhado durante um pedido. */
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

/** Câmbio histórico (fecho do dia, ou do último dia útil anterior) moeda -> EUR. */
export async function getHistoricalFxToEur(currency: string, isoDate: string): Promise<number | null> {
  if (currency === "EUR") return 1;
  try {
    const day = new Date(`${isoDate}T00:00:00Z`);
    const res = await yahooFinance.chart(`${currency}EUR=X`, {
      period1: new Date(day.getTime() - 6 * 86400000),
      period2: new Date(day.getTime() + 2 * 86400000),
      interval: "1d",
    });
    const points = (res.quotes ?? []).filter((q) => typeof q.close === "number");
    if (points.length === 0) return null;
    let best = points[0];
    for (const p of points) {
      if (p.date.getTime() <= day.getTime() + 86400000) best = p;
    }
    return best.close as number;
  } catch (err) {
    console.error(`Falha ao obter câmbio histórico ${currency}/EUR em ${isoDate}:`, err);
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

/** Procura o primeiro símbolo para um texto livre (ticker, nome ou ISIN). Usado no Radar. */
export async function searchSymbol(query: string): Promise<{ symbol: string; name: string } | null> {
  try {
    const result = await yahooFinance.search(query, { quotesCount: 6 });
    const hit = (result.quotes ?? []).find(
      (q) => "symbol" in q && typeof q.symbol === "string" && q.symbol.length > 0
    ) as { symbol: string; shortname?: string; longname?: string } | undefined;
    if (!hit) return null;
    return { symbol: hit.symbol, name: hit.shortname ?? hit.longname ?? hit.symbol };
  } catch (err) {
    console.error(`Falha ao procurar "${query}":`, err);
    return null;
  }
}

export interface NewsItem {
  id: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: number; // ms
}

/** Notícias recentes para um símbolo (ou tema, ex: "stock market"). */
export async function getNews(query: string, count = 4): Promise<NewsItem[]> {
  try {
    const result = await yahooFinance.search(query, { quotesCount: 0, newsCount: count });
    return (result.news ?? []).map((n) => ({
      id: String(n.uuid),
      title: String(n.title),
      publisher: String(n.publisher ?? ""),
      link: String(n.link),
      publishedAt: new Date(n.providerPublishTime as unknown as string | number | Date).getTime(),
    }));
  } catch (err) {
    console.error(`Falha ao obter notícias de "${query}":`, err);
    return [];
  }
}
