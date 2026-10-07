import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/market/quotes";
import { shortTicker } from "@/lib/ticker";
import { formatCurrency, formatPercent, cx } from "@/lib/format";
import { TickerAvatar } from "@/components/ui/ticker-avatar";
import { WatchlistAdd } from "@/components/radar/watchlist-add";
import { RemoveWatchButton } from "@/components/radar/remove-watch-button";

interface WatchRow {
  id: string;
  symbol: string;
  name: string;
  currency: string;
  added_price: number | null;
  added_at: string;
}

const tone = (v: number) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-text-muted");

export default async function RadarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: watch }, { data: held }] = await Promise.all([
    supabase.from("watchlist").select("*").eq("user_id", user!.id).order("added_at", { ascending: false }),
    supabase.from("portfolio_positions").select("symbol, quantity_held").eq("user_id", user!.id).gt("quantity_held", 0.0000001),
  ]);

  const rows: WatchRow[] = watch ?? [];
  const owned = new Set((held ?? []).map((h: { symbol: string | null }) => (h.symbol ?? "").split(".")[0].toUpperCase()));
  const quotes = await Promise.all(rows.map((r) => getQuote(r.symbol)));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 md:py-10 flex flex-col gap-4">
      <WatchlistAdd />
      <p className="text-sm text-text-muted">{rows.length} {rows.length === 1 ? "título" : "títulos"} em observação</p>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted py-10 text-center">
          O Radar é a tua lista de ativos a acompanhar. Escreve um ticker acima, por exemplo TSLA ou BTC-USD.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r, i) => {
            const q = quotes[i];
            const t = shortTicker(r.symbol, r.name);
            const dayPct = q?.changePercent != null ? q.changePercent / 100 : null;
            const dayAbs = q && dayPct !== null ? q.price - q.price / (1 + dayPct) : null;
            const sincePct = q && r.added_price ? q.price / Number(r.added_price) - 1 : null;
            return (
              <li
                key={r.id}
                className={cx(
                  "rounded-2xl border border-line bg-surface p-4 border-l-4",
                  dayPct === null ? "border-l-line" : dayPct >= 0 ? "border-l-gain" : "border-l-loss"
                )}
              >
                <div className="flex items-start gap-3">
                  <TickerAvatar ticker={t} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-lg font-extrabold text-text leading-tight">
                      {t}
                      {owned.has(t) && (
                        <span className="rounded-md bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-gold">JÁ TENS</span>
                      )}
                    </p>
                    <p className="text-sm text-text-muted truncate">{r.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cx("tabular text-lg font-bold", dayPct === null ? "text-text" : tone(dayPct))}>
                      {q ? formatCurrency(q.price, q.currency) : "—"}
                    </p>
                    {dayPct !== null && dayAbs !== null && (
                      <p className={cx("tabular text-sm font-semibold", tone(dayPct))}>
                        {formatPercent(dayPct)} <span className="opacity-60">·</span> {formatCurrency(dayAbs, q!.currency)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-text-muted">
                  <span>Segues desde {new Date(r.added_at).toLocaleDateString("pt-PT")}</span>
                  <span className="flex items-center gap-3">
                    {sincePct !== null && (
                      <span className={cx("tabular font-semibold", tone(sincePct))}>{formatPercent(sincePct)}</span>
                    )}
                    <RemoveWatchButton id={r.id} />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
