import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPortfolioHistory } from "@/lib/data/portfolio-history";

export const maxDuration = 30;

/** GET /api/portfolio-history — evolução do valor da carteira vs capital investido. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    return NextResponse.json(await loadPortfolioHistory(supabase, auth.user.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao calcular o histórico.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
