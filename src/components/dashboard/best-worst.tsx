import { formatPercent, formatSignedCurrency, cx } from "@/lib/format";
import { shortTicker } from "@/lib/ticker";
import { TickerAvatar } from "@/components/ui/ticker-avatar";
import type { EnrichedPosition } from "@/lib/data/net-worth";

function tenure(iso: string | null): string {
  if (!iso) return "";
  const months = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 86400000)));
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? "ano" : "anos"}`);
  if (m > 0 || y === 0) parts.push(`${m} ${m === 1 ? "mês" : "meses"}`);
  return `${parts.join(" e ")} em carteira`;
}

function Card({ title, p }: { title: string; p: EnrichedPosition }) {
  const pnl = p.marketValue - p.net_invested;
  const pct = p.net_invested !== 0 ? pnl / Math.abs(p.net_invested) : 0;
  const up = pnl >= 0;
  const t = shortTicker(p.symbol, p.name);
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-text-muted">{title}</h2>
      <div className="flex items-center gap-3 mt-3">
        <TickerAvatar ticker={t} size={44} />
        <p className="text-2xl font-extrabold text-text">{t}</p>
      </div>
      <p className={cx("tabular text-xl font-bold mt-3", up ? "text-gain" : "text-loss")}>{formatPercent(pct)}</p>
      <p className={cx("tabular text-lg font-semibold", up ? "text-gain" : "text-loss")}>{formatSignedCurrency(pnl)}</p>
      <p className="text-sm text-text-muted mt-2">{tenure(p.first_purchase_at)}</p>
    </section>
  );
}

export function BestWorst({ positions }: { positions: EnrichedPosition[] }) {
  if (positions.length < 2) return null;
  const pct = (p: EnrichedPosition) => (p.net_invested !== 0 ? (p.marketValue - p.net_invested) / Math.abs(p.net_invested) : 0);
  const sorted = [...positions].sort((a, b) => pct(b) - pct(a));
  return (
    <>
      <Card title="Melhor posição" p={sorted[0]} />
      <Card title="Pior posição" p={sorted[sorted.length - 1]} />
    </>
  );
}
