"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
  /** Texto extra opcional a mostrar por baixo do nome na legenda (ex: ISIN). */
  sublabel?: string;
}

/**
 * Quando há demasiadas fatias, o donut fica ilegível e a legenda enche o
 * ecrã todo. Acima deste número, agrupamos as fatias mais pequenas numa
 * única fatia "Outras" — a lista de detalhe completa continua disponível
 * fora deste componente sempre que exista.
 */
const MAX_SLICES = 7;

export function DonutChart({
  slices,
  size = 220,
  emptyMessage,
}: {
  slices: DonutSlice[];
  size?: number;
  emptyMessage?: string;
}) {
  const positive = slices.filter((s) => s.value > 0);
  const sorted = [...positive].sort((a, b) => b.value - a.value);

  let data = sorted;
  if (sorted.length > MAX_SLICES) {
    const head = sorted.slice(0, MAX_SLICES - 1);
    const rest = sorted.slice(MAX_SLICES - 1);
    const restTotal = rest.reduce((sum, s) => sum + s.value, 0);
    data = [...head, { name: "Outras", value: restTotal, color: "#5B6472" }];
  }

  const total = data.reduce((sum, s) => sum + s.value, 0);

  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-text-faint">
        {emptyMessage ?? "Sem dados para mostrar neste período."}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={size * 0.28}
              outerRadius={size * 0.4}
              paddingAngle={2}
              stroke="var(--color-ink)"
              strokeWidth={2}
            >
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--color-surface-alt)",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                `${formatCurrency(Number(value))} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : "0.0"}%)`,
                String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex-1 w-full min-w-0 flex flex-col gap-2">
        {data.map((slice) => {
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          return (
            <li key={slice.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="min-w-0">
                  <span className="text-text truncate block">{slice.name}</span>
                  {slice.sublabel && (
                    <span className="text-text-faint text-xs block">{slice.sublabel}</span>
                  )}
                </span>
              </span>
              <span className="tabular text-text-muted shrink-0 flex items-baseline gap-2">
                {formatCurrency(slice.value)}
                <span className="text-text-faint text-xs w-12 text-right">{pct.toFixed(1)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
