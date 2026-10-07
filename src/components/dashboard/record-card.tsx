import { Sparkles } from "lucide-react";
import { formatCurrency, formatDate, formatPercent, cx } from "@/lib/format";
import type { NetWorthSnapshot } from "@/types/database";

/** Máximo histórico do património (a partir dos snapshots diários). */
export function RecordCard({ current, snapshots }: { current: number; snapshots: NetWorthSnapshot[] }) {
  const previous = snapshots.slice(0, -1);
  if (previous.length === 0) return null;

  const best = previous.reduce((a, b) => (Number(b.total_net_worth) > Number(a.total_net_worth) ? b : a));
  const max = Number(best.total_net_worth);
  const isRecord = current >= max;
  const pctOfMax = max > 0 ? Math.min(1, current / max) : 0;

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-base font-bold text-text">Máximo histórico</h2>
      <p className={cx("flex items-center gap-2 mt-3 text-3xl font-extrabold", isRecord ? "text-gain" : "text-text")}>
        {isRecord && <Sparkles size={26} className="text-gain" />}
        {isRecord ? "Novo máximo" : `${formatPercent(pctOfMax - 1)} do máximo`}
      </p>
      <p className="text-sm text-text-muted mt-2">
        {isRecord ? "Recorde anterior" : "Recorde"} {formatCurrency(max)} · {formatDate(best.snapshot_date)}
      </p>
      <div className="mt-4 h-2 rounded-full bg-surface-alt overflow-hidden">
        <div className={cx("h-full rounded-full", isRecord ? "bg-gain" : "bg-gold")} style={{ width: `${pctOfMax * 100}%` }} />
      </div>
    </section>
  );
}
