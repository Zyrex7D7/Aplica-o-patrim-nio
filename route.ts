import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQuote, resolveSymbolFromIsin } from "@/lib/market/quotes";

/**
 * GET /api/quotes
 * Atualiza o cache `asset_quotes` para todas as posições abertas do
 * utilizador. Usa a bolsa de referência da DEGIRO (assets.exchange) para
 * escolher a mesma listagem que ele vê na corretora, e guarda o preço já
 * convertido para EUR + fecho anterior (variação do dia).
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: positions, error } = await supabase
    .from("portfolio_positions")
    .select("asset_id, symbol, isin, name, quantity_held")
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const open = (positions ?? []).filter((p: { quantity_held: number }) => Number(p.quantity_held) > 0.0000001);
  const assetIds = open.map((p: { asset_id: string }) => p.asset_id);

  const { data: assetRows } = await supabase.from("assets").select("id, exchange").in("id", assetIds);
  const exchangeById = new Map<string, string | null>(
    (assetRows ?? []).map((a: { id: string; exchange: string | null }) => [a.id, a.exchange])
  );

  const fxCache = new Map<string, number | null>();
  const now = new Date().toISOString();

  const results = await Promise.all(
    open.map(
      async (pos: { asset_id: string; symbol: string | null; isin: string | null; name: string }) => {
        let symbol = pos.symbol;
        let newSymbol: string | null = null;

        if (!symbol) {
          const resolved = await resolveSymbolFromIsin(pos.isin ?? pos.name, exchangeById.get(pos.asset_id));
          if (resolved) {
            symbol = resolved.symbol;
            newSymbol = resolved.symbol;
          }
        }
        if (!symbol) return null;

        const quote = await getQuote(symbol, fxCache);
        if (!quote) return null;

        return {
          newSymbol,
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
      }
    )
  );

  const ok = results.filter((r): r is NonNullable<typeof r> => r !== null);

  for (const r of ok) {
    if (r.newSymbol) {
      await supabase.from("assets").update({ symbol: r.newSymbol }).eq("id", r.row.asset_id);
    }
  }

  const updates = ok.map((r) => r.row);
  if (updates.length > 0) {
    const { error: upsertError } = await supabase.from("asset_quotes").upsert(updates, { onConflict: "asset_id" });
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    updated: updates.length,
    failed: open.length - updates.length,
    quotes: updates,
  });
}
