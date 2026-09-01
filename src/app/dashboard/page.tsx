import { createClient } from "@/lib/supabase/server";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import { getNetWorthHistory } from "@/lib/data/net-worth-history";
import { StatCard } from "@/components/dashboard/stat-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { NetWorthHistoryChart } from "@/components/dashboard/net-worth-history-chart";
import { Card, CardLabel } from "@/components/ui/card";
import { formatCurrency, formatSignedCurrency } from "@/lib/format";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [breakdown, history] = await Promise.all([
    getNetWorthBreakdown(supabase, user!.id),
    getNetWorthHistory(supabase, user!.id),
  ]);

  const slices = [
    { name: "Contas Bancárias", value: breakdown.cashInBanks, color: "var(--color-info)" },
    { name: "Poupança", value: breakdown.cashInSavings, color: "#B48CE0" },
    { name: "Corretoras (livre)", value: breakdown.cashInBrokers, color: "var(--color-gold)" },
    { name: "Numerário", value: breakdown.physicalCash, color: "#8A93A3" },
    { name: "Portefólio", value: breakdown.portfolioValue, color: "var(--color-gain)" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10">
      <header className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">
          Património Global
        </p>
        <p className="font-display text-3xl sm:text-4xl md:text-5xl tabular text-text break-words">
          {formatCurrency(breakdown.totalNetWorth)}
        </p>
        <p className="text-sm text-text-muted mt-2">
          Soma de contas bancárias, poupança, saldo livre em corretoras, numerário e valor atual
          do portefólio de investimentos.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <StatCard label="Contas Bancárias" value={breakdown.cashInBanks} />
        <StatCard label="Poupança" value={breakdown.cashInSavings} />
        <StatCard label="Corretoras (saldo livre)" value={breakdown.cashInBrokers} />
        <StatCard label="Numerário" value={breakdown.physicalCash} />
        <StatCard label="Portefólio (valor atual)" value={breakdown.portfolioValue} tone="gold" />
      </div>

      <Card className="mb-4">
        <CardLabel className="mb-1">Evolução do Património</CardLabel>
        <p className="text-xs text-text-faint mb-2">Últimos 90 dias, com um ponto capturado por dia.</p>
        <NetWorthHistoryChart snapshots={history} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardLabel>Distribuição do Património</CardLabel>
          <div className="mt-4">
            <DonutChart slices={slices} emptyMessage="Ainda sem saldo registado — adiciona contas e transações para veres a distribuição." />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardLabel>Investimentos — Custo vs. Valor Atual</CardLabel>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <p className="text-xs text-text-faint">Capital investido</p>
              <p className="tabular text-xl text-text mt-1 break-words">{formatCurrency(breakdown.portfolioCost)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-faint">Lucro / Prejuízo não realizado</p>
              <p
                className={`tabular text-xl mt-1 break-words ${
                  breakdown.portfolioPnl >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {formatSignedCurrency(breakdown.portfolioPnl)}
              </p>
            </div>
          </div>

          <div className="mt-6 ledger-rule pt-4">
            <p className="text-xs text-text-faint mb-3">Posições atuais</p>
            {breakdown.positions.length === 0 ? (
              <p className="text-sm text-text-muted">
                Ainda não importaste transações de bolsa. Vai a{" "}
                <a href="/portfolio" className="text-gold underline underline-offset-2">
                  Portefólio
                </a>{" "}
                para carregar o CSV da DEGIRO.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {breakdown.positions.map((p) => (
                  <li
                    key={p.asset_id}
                    className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-line-soft last:border-0"
                  >
                    <span className="text-text truncate min-w-0">{p.name}</span>
                    <span className="tabular text-text-muted shrink-0">
                      {p.quantity_held.toLocaleString("pt-PT")} un.
                    </span>
                    <span className="tabular text-text shrink-0">{formatCurrency(p.marketValue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
