import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuote, resolveSymbolFromIsin } from "@/lib/market/quotes";

export interface RefreshResult {
  updated: number;
  failed: number;
  error?: string;
}

/**
 * Atualiza as cotações de todas as posições abertas do utilizador.
 * Para cada ativo, (re)descobre a listagem certa a partir do ISIN e da bolsa
 * da DEGIRO — por isso não depende de símbolos escolhidos à mão — e guarda
 * o preço em EUR + fecho anterior. Usado pelo botão "Atualizar cotações" e,
 * automaticamente, logo a seguir a cada importação de CSV.
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
  const { data: assetRows } = await supabase.from("assets").select("id, exchange").in("id", assetIds);
  const exchangeById = new Map<string, string | null>(
    (assetRows ?? []).map((a: { id: string; exchange: string | null }) => [a.id, a.exchange])
  );

  const fxCache = new Map<string, number | null>();
  const now = new Date().toISOString();

  const results = await Promise.all(
    open.map(async (pos: { asset_id: string; symbol: string | null; isin: string | null; name: string }) => {
      const resolved = await resolveSymbolFromIsin(pos.isin ?? pos.name, exchangeById.get(pos.asset_id));
      const symbol = resolved?.symbol ?? pos.symbol;
      if (!symbol) return null;

      const quote = await getQuote(symbol, fxCache);
      if (!quote) return null;

      return {
        newSymbol: symbol !== pos.symbol ? symbol : null,
        row: {
          asset_id: pos.asset_id,
          price: quote.price,
          currency: quote.currency,
          price_eur: quote.priceEur,
          previous_close_eur: quote.previousCloseEur,
          change_percent: quote.changePercent,
          fetched_at: now,
        },
      };
    })
  );

  const ok = results.filter((r): r is NonNullable<typeof r> => r !== null);

  for (const r of ok) {
    if (r.newSymbol) {
      await supabase.from("assets").update({ symbol: r.newSymbol }).eq("id", r.row.asset_id);
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
