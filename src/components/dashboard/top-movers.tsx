import Link from "next/link";
import { formatPercent, formatSignedCurrency, cx } from "@/lib/format";
import { shortTicker } from "@/lib/ticker";
import { TickerAvatar } from "@/components/ui/ticker-avatar";
import type { EnrichedPosition } from "@/lib/data/net-worth";

export function TopMovers({ positions }: { positions: EnrichedPosition[] }) {
  const movers = positions
    .filter((p) => p.dayChangeEur !== null && p.dayChangePct !== null)
    .sort((a, b) => Math.abs(b.dayChangeEur ?? 0) - Math.abs(a.dayChangeEur ?? 0))
    .slice(0, 5);
  if (movers.length === 0) return null;

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text">Principais movers</h2>
        <Link href="/noticias" className="text-sm text-gold">Notícias</Link>
      </div>
      <ul className="flex flex-col gap-3">
        {movers.map((p) => {
          const t = shortTicker(p.symbol, p.name);
          const up = (p.dayChangeEur ?? 0) >= 0;
          return (
            <li key={p.asset_id} className="flex items-center gap-3">
              <TickerAvatar ticker={t} />
              <p className="font-bold text-text flex-1 min-w-0 truncate">{t}</p>
              <p className={cx("tabular text-sm text-right font-semibold", up ? "text-gain" : "text-loss")}>
                {formatPercent(p.dayChangePct ?? 0)} <span className="opacity-60">·</span>{" "}
                {formatSignedCurrency(p.dayChangeEur ?? 0)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
