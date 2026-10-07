"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { formatCurrency, formatPercent, formatSignedCurrency, cx } from "@/lib/format";
import { shortTicker } from "@/lib/ticker";
import { TickerAvatar } from "@/components/ui/ticker-avatar";

export interface PositionRow {
  asset_id: string;
  name: string;
  symbol: string | null;
  isin: string | null;
  quantity_held: number;
  net_invested: number;
  total_dividends: number;
  total_fees: number;
  first_purchase_at: string | null;
  currentPrice: number | null;
  marketValue: number;
  dayChangePct?: number | null;
  dayChangeEur?: number | null;
}

export interface ClosedRow {
  asset_id: string;
  name: string;
  symbol: string | null;
  realizedPnl: number;
  total_dividends: number;
}

const tone = (v: number) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-text-muted");

export function HoldingsTable({
  positions,
  closed,
  portfolioDayPct,
  benchmarkPct,
}: {
  positions: PositionRow[];
  closed: ClosedRow[];
  portfolioDayPct: number | null;
  benchmarkPct: number | null;
}) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const open = [...positions]
    .sort((a, b) => b.marketValue - a.marketValue)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.symbol ?? "").toLowerCase().includes(q));
  const done = closed.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.symbol ?? "").toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-6 border-b border-line">
        {([
          { key: "open", label: "Abertas", n: positions.length },
          { key: "closed", label: "Fechadas", n: closed.length },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "pb-3 -mb-px text-base font-semibold border-b-2 transition-colors",
              tab === t.key ? "border-gold text-gold" : "border-transparent text-text-muted"
            )}
          >
            {t.label} <span className="font-normal">{t.n}</span>
          </button>
        ))}
      </div>

      {tab === "open" && portfolioDayPct !== null && (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm flex flex-wrap items-center gap-x-2">
          <span className="font-bold text-text">Carteira</span>
          <span className={cx("tabular font-semibold", tone(portfolioDayPct))}>{formatPercent(portfolioDayPct)}</span>
          {benchmarkPct !== null && (
            <>
              <span className="text-text-faint">· vs S&amp;P 500</span>
              <span className={cx("tabular font-semibold", tone(benchmarkPct))}>{formatPercent(benchmarkPct)}</span>
            </>
          )}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar…"
          className="w-full rounded-2xl border border-line bg-surface pl-10 pr-4 py-3 text-sm outline-none focus:border-gold"
        />
      </div>

      {tab === "open" ? (
        open.length === 0 ? (
          <p className="text-sm text-text-muted py-8 text-center">
            {positions.length === 0 ? "Ainda sem posições. Importa um extrato da DEGIRO mais abaixo." : "Nada encontrado."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((p) => {
              const pnl = p.marketValue - p.net_invested;
              const totalReturn = pnl + p.total_dividends;
              const totalPct = p.net_invested !== 0 ? totalReturn / Math.abs(p.net_invested) : 0;
              const t = shortTicker(p.symbol, p.name);
              return (
                <li
                  key={p.asset_id}
                  className={cx(
                    "rounded-2xl border border-line bg-surface p-4 border-l-4",
                    totalReturn >= 0 ? "border-l-gain" : "border-l-loss"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <TickerAvatar ticker={t} />
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-extrabold text-text leading-tight">{t}</p>
                      <p className="text-sm text-text-muted truncate">{p.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="tabular text-lg font-bold text-text">{formatCurrency(p.marketValue)}</p>
                      <p className={cx("tabular text-sm font-semibold", tone(totalReturn))}>{formatPercent(totalPct)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <p className="text-text-muted tabular">
                      {p.currentPrice !== null ? formatCurrency(p.currentPrice) : "—"}{" "}
                      <span className="text-text-faint">·</span>{" "}
                      {p.quantity_held.toLocaleString("pt-PT", { maximumFractionDigits: 4 })} un.
                    </p>
                    {p.dayChangePct != null && p.dayChangeEur != null ? (
                      <p className={cx("tabular font-semibold", tone(p.dayChangeEur))}>
                        {formatPercent(p.dayChangePct)} <span className="opacity-60">·</span> {formatSignedCurrency(p.dayChangeEur)}
                      </p>
                    ) : (
                      <p className="text-text-faint">Sem cotação</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : done.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">Ainda não fechaste nenhuma posição.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {done.map((p) => {
            const t = shortTicker(p.symbol, p.name);
            const total = p.realizedPnl + p.total_dividends;
            return (
              <li key={p.asset_id} className="rounded-2xl border border-line bg-surface p-4 flex items-center gap-3">
                <TickerAvatar ticker={t} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold text-text leading-tight">{t}</p>
                  <p className="text-sm text-text-muted truncate">{p.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cx("tabular text-lg font-bold", tone(total))}>{formatSignedCurrency(total)}</p>
                  <p className="text-xs text-text-faint">lucro realizado</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
