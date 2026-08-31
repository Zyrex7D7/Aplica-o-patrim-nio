"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency, formatDate } from "@/lib/format";
import type { NetWorthSnapshot } from "@/types/database";

export function NetWorthHistoryChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-text-faint text-center px-4">
        Ainda não há histórico suficiente. Volta amanhã para veres a evolução do património.
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    date: s.snapshot_date,
    total: Number(s.total_net_worth),
  }));

  const first = data[0].total;
  const last = data[data.length - 1].total;
  const changePct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`tabular text-sm ${changePct >= 0 ? "text-gain" : "text-loss"}`}>
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(1)}%
        </span>
        <span className="text-xs text-text-faint">desde {formatDate(data[0].date)}</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-soft)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(d).replace(/ de \d{4}$/, "")}
            tick={{ fill: "var(--color-text-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis hide domain={["dataMin - 100", "dataMax + 100"]} />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-line)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(d) => formatDate(String(d))}
            formatter={(value) => [formatCurrency(Number(value)), "Património"]}
          />
          <Line type="monotone" dataKey="total" stroke="var(--color-gold)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
