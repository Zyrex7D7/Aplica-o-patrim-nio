import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQuotes, resolveSymbolFromIsin } from "@/lib/market/quotes";

/**
 * GET /api/quotes
 * Atualiza o cache `asset_quotes` com cotações atuais para todos os ativos
 * do portefólio do utilizador autenticado, resolvendo o símbolo Yahoo
 * Finance a partir do ISIN quando ainda não o conhecemos.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: positions, error } = await supabase
    .from("portfolio_positions")
    .select("asset_id, symbol, isin, name")
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updates: { asset_id: string; price: number; currency: string; fetched_at: string }[] = [];
  const resolvedSymbols: { asset_id: string; symbol: string }[] = [];

  for (const pos of positions ?? []) {
    let symbol = pos.symbol as string | null;

    if (!symbol) {
      const resolved = await resolveSymbolFromIsin(pos.isin ?? pos.name);
      if (resolved) {
        symbol = resolved.symbol;
        resolvedSymbols.push({ asset_id: pos.asset_id, symbol });
      }
    }
    if (!symbol) continue;

    const [quote] = await getQuotes([symbol]);
    if (quote) {
      updates.push({
        asset_id: pos.asset_id,
        price: quote.price,
        currency: quote.currency,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  // Persiste o símbolo Yahoo Finance recém-descoberto no catálogo de ativos.
  for (const r of resolvedSymbols) {
    await supabase.from("assets").update({ symbol: r.symbol }).eq("id", r.asset_id);
  }

  if (updates.length > 0) {
    await supabase.from("asset_quotes").upsert(updates, { onConflict: "asset_id" });
  }

  return NextResponse.json({ updated: updates.length, quotes: updates });
}
