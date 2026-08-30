"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/format";

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

export function CategoryBreakdownChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-text-faint">
        Sem despesas registadas neste período.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, sorted.length * 42)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 24 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-alt)" }}
          contentStyle={{
            background: "var(--color-surface-alt)",
            border: "1px solid var(--color-line)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
          {sorted.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
