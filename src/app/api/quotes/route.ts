import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshQuotes } from "@/lib/market/refresh";

export const maxDuration = 60;

/** GET /api/quotes — atualiza as cotações de todas as posições abertas. */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const result = await refreshQuotes(supabase, auth.user.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
