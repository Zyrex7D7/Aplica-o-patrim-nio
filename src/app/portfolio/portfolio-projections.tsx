"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { buildProjection, buildScenarios, DEFAULT_MODERATE_RATE } from "@/lib/reports/projections";

const YEAR_OPTIONS = [5, 10, 20, 30];

const SCENARIO_LABEL: Record<"conservador" | "moderado" | "otimista", string> = {
  conservador: "Conservador",
  moderado: "Moderado",
  otimista: "Otimista",
};

export function PortfolioProjections({
  currentValue,
  estimatedAnnualRatePct,
}: {
  currentValue: number;
  estimatedAnnualRatePct: number | null;
}) {
  const [monthlyContribution, setMonthlyContribution] = useState(0);
  const [years, setYears] = useState(10);
  const [moderateRate, setModerateRate] = useState(
    estimatedAnnualRatePct !== null ? Math.round(estimatedAnnualRatePct * 10) / 10 : DEFAULT_MODERATE_RATE
  );

  const rates = useMemo(() => buildScenarios(moderateRate), [moderateRate]);
  const data = useMemo(
    () => buildProjection(currentValue, monthlyContribution, rates, years),
    [currentValue, monthlyContribution, rates, years]
  );

  const final = data[data.length - 1];

  if (currentValue <= 0) {
    return (
      <p className="text-sm text-text-muted py-6 text-center">
        Ainda não tens posições no portefólio — importa um extrato da DEGIRO para veres projeções.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-text-faint">
            Investimento mensal adicional
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={monthlyContribution}
            onChange={(e) => {
              const n = Number(e.target.value.replace(",", "."));
              setMonthlyContribution(Number.isFinite(n) ? Math.max(0, n) : 0);
            }}
            className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-text-faint">
            Horizonte temporal
          </span>
          <select
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y} anos
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-text-faint">
            Retorno anual esperado (cenário moderado)
          </span>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={moderateRate}
              onChange={(e) => {
                const n = Number(e.target.value.replace(",", "."));
                setModerateRate(Number.isFinite(n) ? n : 0);
              }}
              className="w-full rounded-md border border-line bg-surface-alt px-3 py-2 pr-7 text-sm outline-none focus:border-gold tabular"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-faint">%</span>
          </div>
        </label>
      </div>

      <p className="text-[11px] text-text-faint leading-relaxed">
        {estimatedAnnualRatePct !== null
          ? `Sugestão calculada a partir da evolução recente do teu portefólio (~${estimatedAnnualRatePct.toFixed(1)}%/ano). `
          : "Ainda não há histórico suficiente para estimar uma taxa a partir dos teus dados — foi usada uma média de referência do mercado de ações (7%/ano). "}
        Os cenários conservador e otimista usam -3 e +3 pontos percentuais em torno do valor
        moderado. Ajusta os valores acima como quiseres — isto é uma simulação, não uma promessa de
        retorno.
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-soft)" vertical={false} />
          <XAxis
            dataKey="year"
            tickFormatter={(y) => `Ano ${y}`}
            tick={{ fill: "var(--color-text-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(Number(v))}
            tick={{ fill: "var(--color-text-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-line)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(y) => `Ano ${y}`}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              SCENARIO_LABEL[name as "conservador" | "moderado" | "otimista"],
            ]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                {SCENARIO_LABEL[value as "conservador" | "moderado" | "otimista"]}
              </span>
            )}
          />
          <Line type="monotone" dataKey="conservador" stroke="var(--color-loss)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="moderado" stroke="var(--color-gold)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="otimista" stroke="var(--color-gain)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-loss/30 bg-loss-soft/40 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-1">
            Conservador ({rates.conservador.toFixed(1)}%/ano)
          </p>
          <p className="tabular text-lg text-loss">{formatCurrency(final.conservador)}</p>
        </div>
        <div className="rounded-lg border border-gold/30 bg-gold-soft/40 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-1">
            Moderado ({rates.moderado.toFixed(1)}%/ano)
          </p>
          <p className="tabular text-lg text-gold">{formatCurrency(final.moderado)}</p>
        </div>
        <div className="rounded-lg border border-gain/30 bg-gain-soft/40 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-1">
            Otimista ({rates.otimista.toFixed(1)}%/ano)
          </p>
          <p className="tabular text-lg text-gain">{formatCurrency(final.otimista)}</p>
        </div>
      </div>

      <p className="text-[11px] text-text-faint leading-relaxed ledger-rule pt-3">
        Estas projeções assumem uma taxa de retorno constante e investimentos mensais constantes —
        na realidade os mercados sobem e descem de forma irregular, e a taxa sugerida é calculada a
        partir de um histórico ainda curto. Serve para teres uma noção de ordem de grandeza, nunca
        como garantia de resultado nem como aconselhamento financeiro.
      </p>
    </div>
  );
}
