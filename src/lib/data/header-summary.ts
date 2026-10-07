import { createClient } from "@/lib/supabase/server";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import type { HeaderSummary } from "@/components/mobile-header";

/** Aproximação: dias úteis, 07:00–21:00 UTC (cobre bolsas europeias e as dos EUA). */
function isMarketOpen(now = new Date()): boolean {
  const day = now.getUTCDay();
  const h = now.getUTCHours();
  return day >= 1 && day <= 5 && h >= 7 && h < 21;
}

export async function getHeaderSummary(): Promise<HeaderSummary | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const b = await getNetWorthBreakdown(supabase, user.id);
    return {
      hasQuotes: b.lastQuoteAt !== null && b.positions.some((p) => p.dayChangeEur !== null),
      dayChangeEur: b.dayChangeEur,
      dayChangePct: b.dayChangePct,
      lastQuoteAt: b.lastQuoteAt,
      marketOpen: isMarketOpen(),
    };
  } catch {
    return null;
  }
}
