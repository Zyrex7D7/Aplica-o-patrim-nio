import { formatCurrency, formatPercent } from "@/lib/format";
import type { PositionRow } from "@/components/portfolio/holdings-table";

function pnlPct(p: PositionRow): number {
  const pnl = p.marketValue - p.net_invested;
  return p.net_invested !== 0 ? pnl / Math.abs(p.net_invested) : 0;
}

export function PerformanceHighlights({ positions }: { positions: PositionRow[] }) {
  if (positions.length < 2) return null;

  const sorted = [...positions].sort((a, b) => pnlPct(b) - pnlPct(a));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-lg border border-line-soft bg-surface-alt/40 px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-1">
          Melhor Posição
        </p>
        <p className="text-text text-sm">{best.name}</p>
        <p className="tabular text-gain text-lg mt-1">
          {formatPercent(pnlPct(best))}
          <span className="text-xs text-text-faint ml-2">
            ({formatCurrency(best.marketValue - best.net_invested)})
          </span>
        </p>
      </div>
      <div className="rounded-lg border border-line-soft bg-surface-alt/40 px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-1">
          Pior Posição
        </p>
        <p className="text-text text-sm">{worst.name}</p>
        <p className={`tabular text-lg mt-1 ${pnlPct(worst) >= 0 ? "text-gain" : "text-loss"}`}>
          {formatPercent(pnlPct(worst))}
          <span className="text-xs text-text-faint ml-2">
            ({formatCurrency(worst.marketValue - worst.net_invested)})
          </span>
        </p>
      </div>
    </div>
  );
}
