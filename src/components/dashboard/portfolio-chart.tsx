"use client";

import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate, formatPercent, formatSignedCurrency, cx } from "@/lib/format";

interface Point {
  date: string;
  value: number;
  invested: number;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; series: Point[]; missing: string[] };

const RANGES = [
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1a", label: "1A", days: 365 },
  { key: "max", label: "Max", days: 100000 },
] as const;

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const gain = p.value - p.invested;
  return (
    <div className="rounded-xl border border-line bg-surface-alt px-3 py-2 text-xs shadow-lg">
      <p className="text-text-muted mb-1">{formatDate(p.date)}</p>
      <p className="text-text">Carteira: <span className="font-semibold tabular">{formatCurrency(p.value)}</span></p>
      <p className="text-text-muted">Investido: <span className="tabular">{formatCurrency(p.invested)}</span></p>
      <p className={cx("font-semibold tabular", gain >= 0 ? "text-gain" : "text-loss")}>{formatSignedCurrency(gain)}</p>
    </div>
  );
}

/** Progressão da carteira: valor ao longo do tempo (área) contra o capital investido (tracejado). */
export function PortfolioChart() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("max");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio-history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar o histórico.");
      setState({ status: "ok", series: data.series ?? [], missing: data.missing ?? [] });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Erro ao carregar o histórico." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const days = RANGES.find((r) => r.key === range)!.days;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const series = state.status === "ok" ? state.series.filter((p) => p.date >= since) : [];
  const last = series[series.length - 1];
  const first = series[0];
  const gain = last ? last.value - last.invested : 0;
  const gainPct = last && last.invested > 0 ? gain / last.invested : 0;
  const periodChange = last && first ? last.value - first.value : 0;
  const up = gain >= 0;
  const color = up ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-base font-bold text-text">Progressão da carteira</h2>
      <p className="text-xs text-text-faint mt-1">Valor das tuas ações e ETFs ao longo do tempo, contra o dinheiro que lá puseste.</p>

      <div className="flex gap-1.5 mt-3">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              range === r.key ? "bg-gold text-ink" : "bg-surface-alt text-text-muted"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {state.status === "loading" && <div className="mt-4 h-52 animate-pulse rounded-2xl bg-surface-alt" />}

      {state.status === "error" && (
        <div className="mt-4 rounded-2xl bg-surface-alt p-4 text-sm text-text-muted">
          <p>{state.message}</p>
          <button
            onClick={() => {
              setState({ status: "loading" });
              void load();
            }}
            className="mt-2 text-gold font-semibold"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === "ok" && series.length < 2 && (
        <p className="h-40 flex items-center justify-center text-sm text-text-faint text-center">
          Ainda não há compras suficientes para desenhar a evolução.
        </p>
      )}

      {state.status === "ok" && series.length >= 2 && last && (
        <>
          <div className="mt-4">
            <p className="tabular text-3xl font-extrabold text-text">{formatCurrency(last.value)}</p>
            <p className={cx("tabular text-sm font-semibold mt-1", up ? "text-gain" : "text-loss")}>
              {formatSignedCurrency(gain)} ({formatPercent(gainPct)}) <span className="text-text-muted font-normal">face ao investido ({formatCurrency(last.invested)})</span>
            </p>
            {range !== "max" && (
              <p className="text-xs text-text-faint mt-1">
                No período selecionado: <span className="tabular">{formatSignedCurrency(periodChange)}</span>
              </p>
            )}
          </div>
          <div className="mt-3 -mx-2">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="valFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="invested" stroke="var(--color-text-faint)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} />
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#valFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {state.missing.length > 0 && (
            <p className="text-xs text-text-faint mt-2">
              Sem preços históricos de {state.missing.join(", ")}: aparecem ao custo.
            </p>
          )}
        </>
      )}
    </section>
  );
}
