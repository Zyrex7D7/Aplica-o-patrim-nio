import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuote, resolveSymbolFromIsin } from "@/lib/market/quotes";

export interface RefreshResult {
  updated: number;
  failed: number;
  error?: string;
}

/** Só voltamos a descobrir a listagem de um ativo de 7 em 7 dias (poupa dezenas de chamadas ao Yahoo). */
const RESOLVE_TTL_MS = 7 * 24 * 3600 * 1000;

/**
 * Atualiza as cotações de todas as posições abertas do utilizador.
 * - A listagem de cada ativo é descoberta a partir do ISIN + bolsa da DEGIRO e
 *   guardada em `assets.symbol` (com data), por isso não depende de símbolos à mão.
 * - Se o preço em EUR não puder ser calculado (ex: câmbio indisponível), o ativo conta como
 *   falhado e a cotação anterior mantém-se — nunca é substituída por um valor vazio.
 */
export async function refreshQuotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string
): Promise<RefreshResult> {
  const { data: positions, error } = await supabase
    .from("portfolio_positions")
    .select("asset_id, symbol, isin, name, quantity_held")
    .eq("user_id", userId);

  if (error) return { updated: 0, failed: 0, error: error.message };

  const open = (positions ?? []).filter((p: { quantity_held: number }) => Number(p.quantity_held) > 0.0000001);
  if (open.length === 0) return { updated: 0, failed: 0 };

  const assetIds = open.map((p: { asset_id: string }) => p.asset_id);
  const { data: assetRows } = await supabase
    .from("assets")
    .select("id, exchange, symbol_resolved_at")
    .in("id", assetIds);
  const metaById = new Map<string, { exchange: string | null; resolvedAt: number | null }>(
    (assetRows ?? []).map((a: { id: string; exchange: string | null; symbol_resolved_at: string | null }) => [
      a.id,
      { exchange: a.exchange, resolvedAt: a.symbol_resolved_at ? new Date(a.symbol_resolved_at).getTime() : null },
    ])
  );

  const fxCache = new Map<string, number | null>();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const results = await Promise.all(
    open.map(async (pos: { asset_id: string; symbol: string | null; isin: string | null; name: string }) => {
      const meta = metaById.get(pos.asset_id);
      const stale = !pos.symbol || meta?.resolvedAt == null || nowMs - meta.resolvedAt > RESOLVE_TTL_MS;

      let symbol = pos.symbol;
      let resolvedNow = false;
      if (stale) {
        const resolved = await resolveSymbolFromIsin(pos.isin ?? pos.name, meta?.exchange);
        if (resolved) {
          symbol = resolved.symbol;
          resolvedNow = true;
        }
      }
      if (!symbol) return null;

      const quote = await getQuote(symbol, fxCache);
      if (!quote || quote.priceEur === null) return null;

      return {
        assetId: pos.asset_id,
        newSymbol: resolvedNow ? symbol : null,
        row: {
          asset_id: pos.asset_id,
          price: quote.price,
          currency: quote.currency,
          price_eur: quote.priceEur,
          previous_close_eur: quote.previousCloseEur,
          change_percent: quote.changePercent,
          fetched_at: nowIso,
        },
      };
    })
  );

  const ok = results.filter((r): r is NonNullable<typeof r> => r !== null);

  for (const r of ok) {
    if (r.newSymbol) {
      await supabase.from("assets").update({ symbol: r.newSymbol, symbol_resolved_at: nowIso }).eq("id", r.assetId);
    }
  }

  if (ok.length > 0) {
    const { error: upsertError } = await supabase
      .from("asset_quotes")
      .upsert(ok.map((r) => r.row), { onConflict: "asset_id" });
    if (upsertError) return { updated: 0, failed: open.length, error: upsertError.message };
  }

  return { updated: ok.length, failed: open.length - ok.length };
}
