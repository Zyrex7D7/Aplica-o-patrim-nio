import type { SupabaseClient } from "@supabase/supabase-js";
import { getHistoricalPricesEur, type DailyClose } from "@/lib/market/quotes";

export interface HistoryTx {
  asset_id: string;
  operation: string;
  quantity: number | null;
  total_value: number;
  occurred_on: string;
}

export interface SeriesPoint {
  date: string;
  /** Valor da carteira nesse dia (unidades que tinhas × preço de fecho, em EUR). */
  value: number;
  /** Quanto tinhas investido nessas unidades (custo médio × quantidade). */
  invested: number;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Reconstrói, dia útil a dia útil, o valor da carteira e o capital investido.
 * Função pura (sem rede): recebe as transações e os fechos diários em EUR de cada ativo.
 * - Compra: soma unidades e custo. Venda: retira unidades ao custo médio.
 * - Sem preço para um ativo, usa o custo (linha plana em vez de um buraco).
 */
export function buildPortfolioSeries(
  txs: HistoryTx[],
  prices: Map<string, DailyClose[]>,
  endIso: string
): SeriesPoint[] {
  const trades = txs
    .filter((t) => (t.operation === "compra" || t.operation === "venda") && Number(t.quantity) > 0)
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  if (trades.length === 0) return [];

  type State = { qty: number; cost: number; last: number | null; idx: number };
  const state = new Map<string, State>();
  const get = (id: string): State => {
    let s = state.get(id);
    if (!s) {
      s = { qty: 0, cost: 0, last: null, idx: 0 };
      state.set(id, s);
    }
    return s;
  };

  const out: SeriesPoint[] = [];
  let ti = 0;

  for (let day = trades[0].occurred_on; day <= endIso; day = addDays(day, 1)) {
    while (ti < trades.length && trades[ti].occurred_on <= day) {
      const t = trades[ti++];
      const s = get(t.asset_id);
      const q = Number(t.quantity);
      if (t.operation === "compra") {
        s.qty += q;
        s.cost += -Number(t.total_value);
      } else if (s.qty > 0) {
        const sold = Math.min(q, s.qty);
        s.cost -= s.cost * (sold / s.qty);
        s.qty -= sold;
        if (s.qty < 1e-9) {
          s.qty = 0;
          s.cost = 0;
        }
      }
    }

    for (const [id, s] of state) {
      const series = prices.get(id);
      while (series && s.idx < series.length && series[s.idx].date <= day) {
        s.last = series[s.idx].close;
        s.idx++;
      }
    }

    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) continue; // sem bolsa ao fim de semana

    let value = 0;
    let invested = 0;
    for (const s of state.values()) {
      if (s.qty <= 0) continue;
      value += s.qty * (s.last ?? s.cost / s.qty);
      invested += s.cost;
    }
    out.push({ date: day, value: round2(value), invested: round2(invested) });
  }
  return out;
}

export interface HistoryPayload {
  series: SeriesPoint[];
  /** Ativos sem preços históricos (aparecem ao custo). */
  missing: string[];
}

const cache = new Map<string, { at: number; payload: HistoryPayload }>();
const TTL_MS = 30 * 60 * 1000;

/** Carrega as transações e os preços históricos e devolve a série pronta a desenhar (com cache de 30 min). */
export async function loadPortfolioHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<HistoryPayload> {
  const { data: txs, error } = await supabase
    .from("asset_transactions")
    .select("asset_id, operation, quantity, total_value, occurred_on")
    .eq("user_id", userId)
    .in("operation", ["compra", "venda"])
    .order("occurred_on", { ascending: true });
  if (error) throw new Error(error.message);
  if (!txs || txs.length === 0) return { series: [], missing: [] };

  const assetIds = [...new Set((txs as HistoryTx[]).map((t) => t.asset_id))];
  const { data: assets } = await supabase.from("assets").select("id, symbol, name").in("id", assetIds);
  const list = (assets ?? []) as { id: string; symbol: string | null; name: string }[];

  const today = new Date().toISOString().slice(0, 10);
  const first = (txs as HistoryTx[])[0].occurred_on;
  const key = [userId, txs.length, (txs as HistoryTx[])[txs.length - 1].occurred_on, today, list.map((a) => a.symbol).join(",")].join("|");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.payload;

  const withSymbol = list.filter((a) => a.symbol);
  const results = await Promise.all(withSymbol.map(async (a) => [a, await getHistoricalPricesEur(a.symbol as string, first, today)] as const));

  const prices = new Map<string, DailyClose[]>();
  for (const [a, series] of results) if (series) prices.set(a.id, series);

  // Se NENHUM ativo tem preços, não vale a pena desenhar uma linha plana ao custo.
  if (withSymbol.length > 0 && prices.size === 0) throw new Error("Preços históricos indisponíveis (Yahoo Finance).");

  const missing = list.filter((a) => !prices.has(a.id)).map((a) => a.name);
  const payload: HistoryPayload = { series: buildPortfolioSeries(txs as HistoryTx[], prices, today), missing };
  cache.set(key, { at: Date.now(), payload });
  return payload;
}
