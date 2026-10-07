"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate, formatSignedCurrency, cx } from "@/lib/format";
import type { NetWorthSnapshot } from "@/types/database";

const RANGES = [
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1a", label: "1A", days: 365 },
  { key: "max", label: "Max", days: 100000 },
] as const;

/** Retorno acumulado do portefólio (valor − capital investido) ao longo do tempo. */
export function ReturnChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("max");
  const days = RANGES.find((r) => r.key === range)!.days;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const data = snapshots
    .filter((s) => s.snapshot_date >= since)
    .map((s) => ({ date: s.snapshot_date, ret: Number(s.portfolio_value) - Number(s.portfolio_cost) }));

  const last = data[data.length - 1]?.ret ?? 0;
  const first = data[0]?.ret ?? 0;
  const up = last >= 0;
  const color = up ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-base font-bold text-text">Retorno total acumulado</h2>
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

      {data.length < 2 ? (
        <p className="h-48 flex items-center justify-center text-sm text-text-faint text-center">
          O histórico começa a ser guardado hoje. Volta amanhã para ver a evolução.
        </p>
      ) : (
        <>
          <p className={cx("tabular text-lg font-bold mt-4", up ? "text-gain" : "text-loss")}>
            {formatSignedCurrency(last)}
            <span className="text-sm font-medium text-text-muted ml-2">
              ({formatSignedCurrency(last - first)} no período)
            </span>
          </p>
          <div className="mt-2 -mx-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="retFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  contentStyle={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-line)", borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(d) => formatDate(String(d))}
                  formatter={(v) => [formatCurrency(Number(v)), "Retorno"]}
                />
                <Area type="monotone" dataKey="ret" stroke={color} strokeWidth={2} fill="url(#retFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
