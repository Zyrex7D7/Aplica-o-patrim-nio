import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatPercent, formatSignedCurrency, cx } from "@/lib/format";
import { shortTicker } from "@/lib/ticker";
import type { EnrichedPosition } from "@/lib/data/net-worth";

/** Posições que mais mexeram hoje (em €), com ticker, % e valor. */
export function TopMovers({ positions }: { positions: EnrichedPosition[] }) {
  const movers = positions
    .filter((p) => p.dayChangeEur !== null && p.dayChangePct !== null)
    .sort((a, b) => Math.abs(b.dayChangeEur ?? 0) - Math.abs(a.dayChangeEur ?? 0))
    .slice(0, 5);

  if (movers.length === 0) return null;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <p className="text-sm font-medium text-text">Maiores movimentos hoje</p>
        <Link href="/portfolio" className="text-xs text-gold">
          Ver carteira
        </Link>
      </div>
      <ul>
        {movers.map((p) => {
          const up = (p.dayChangeEur ?? 0) >= 0;
          return (
            <li
              key={p.asset_id}
              className="flex items-center justify-between gap-3 px-5 py-3 border-t border-line-soft"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">{shortTicker(p.symbol, p.name)}</p>
                <p className="text-xs text-text-faint truncate">{p.name}</p>
              </div>
              <div className={cx("tabular text-right shrink-0", up ? "text-gain" : "text-loss")}>
                <p className="text-sm">{formatPercent(p.dayChangePct ?? 0)}</p>
                <p className="text-xs opacity-80">{formatSignedCurrency(p.dayChangeEur ?? 0)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
