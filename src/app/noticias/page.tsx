import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import { getNews, type NewsItem } from "@/lib/market/quotes";
import { shortTicker } from "@/lib/ticker";
import { formatPercent, cx } from "@/lib/format";
import { TickerAvatar } from "@/components/ui/ticker-avatar";

type Tab = "carteira" | "radar" | "mercado";
const TABS: { key: Tab; label: string }[] = [
  { key: "carteira", label: "Carteira" },
  { key: "radar", label: "Radar" },
  { key: "mercado", label: "Mercado" },
];

interface Entry extends NewsItem {
  ticker: string | null;
  dayPct: number | null;
  weight: number | null;
  roi: number | null;
}

function timeAgo(ms: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `há ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

export default async function NoticiasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "radar" || tabParam === "mercado" ? tabParam : "carteira";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let entries: Entry[] = [];

  if (tab === "carteira") {
    const b = await getNetWorthBreakdown(supabase, user!.id);
    const top = [...b.positions].filter((p) => p.symbol).sort((a, c) => c.marketValue - a.marketValue).slice(0, 8);
    const results = await Promise.all(top.map((p) => getNews(p.symbol!, 2)));
    entries = top.flatMap((p, i) =>
      results[i].map((n) => ({
        ...n,
        ticker: shortTicker(p.symbol, p.name),
        dayPct: p.dayChangePct,
        weight: b.portfolioValue > 0 ? p.marketValue / b.portfolioValue : null,
        roi: p.net_invested !== 0 ? (p.marketValue - p.net_invested) / Math.abs(p.net_invested) : null,
      }))
    );
  } else if (tab === "radar") {
    const { data: watch } = await supabase.from("watchlist").select("symbol, name").eq("user_id", user!.id).limit(8);
    const list = (watch ?? []) as { symbol: string; name: string }[];
    const results = await Promise.all(list.map((w) => getNews(w.symbol, 2)));
    entries = list.flatMap((w, i) =>
      results[i].map((n) => ({ ...n, ticker: shortTicker(w.symbol, w.name), dayPct: null, weight: null, roi: null }))
    );
  } else {
    const news = await getNews("stock market", 12);
    entries = news.map((n) => ({ ...n, ticker: null, dayPct: null, weight: null, roi: null }));
  }

  const seen = new Set<string>();
  entries = entries
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => b.publishedAt - a.publishedAt);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 md:py-10 flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-extrabold text-text">Notícias</h1>
        <p className="text-text-muted mt-1">As tuas posições nas notícias</p>
      </header>

      <div className="grid grid-cols-3 rounded-2xl bg-surface-alt p-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/noticias?tab=${t.key}`}
            className={cx(
              "rounded-xl py-2.5 text-center text-sm font-semibold transition-colors",
              tab === t.key ? "bg-ink text-text" : "text-text-muted"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-text-muted py-10 text-center">
          {tab === "radar"
            ? "Adiciona ativos ao Radar para ver as notícias deles aqui."
            : "Sem notícias de momento. Confirma que as posições têm cotações atualizadas."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((e) => (
            <li key={e.id} className="py-5 border-b border-line-soft last:border-0">
              {e.ticker && (
                <div className="flex items-center gap-3 mb-3">
                  <TickerAvatar ticker={e.ticker} size={32} />
                  <p className="font-bold text-text">{e.ticker}</p>
                </div>
              )}
              <a href={e.link} target="_blank" rel="noopener noreferrer" className="block text-lg font-semibold text-text leading-snug">
                {e.title}
              </a>
              {(e.dayPct !== null || e.weight !== null || e.roi !== null) && (
                <p className="text-sm text-text-muted mt-2 flex flex-wrap gap-x-2">
                  {e.dayPct !== null && (
                    <span className={cx("tabular font-semibold", e.dayPct >= 0 ? "text-gain" : "text-loss")}>{formatPercent(e.dayPct)}</span>
                  )}
                  {e.weight !== null && <span>· {(e.weight * 100).toFixed(0)}% da carteira</span>}
                  {e.roi !== null && (
                    <span className={cx("tabular", e.roi >= 0 ? "text-gain" : "text-loss")}>· ROI {formatPercent(e.roi)}</span>
                  )}
                </p>
              )}
              <p className="text-sm text-text-faint mt-2 flex items-center gap-1.5">
                {e.publisher} · {timeAgo(e.publishedAt)} <ExternalLink size={13} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
