"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/format";

interface Slice {
  name: string;
  value: number;
  color: string;
}

export function NetWorthPie({ slices }: { slices: Slice[] }) {
  const data = slices.filter((s) => s.value > 0);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-text-faint">
        Ainda sem saldo registado — adiciona contas e transações para veres a distribuição.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={70}
          outerRadius={100}
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
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
