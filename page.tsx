import { createClient } from "@/lib/supabase/server";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import { getNetWorthHistory } from "@/lib/data/net-worth-history";
import { HeroCard } from "@/components/dashboard/hero-card";
import { TopMovers } from "@/components/dashboard/top-movers";
import { StatCard } from "@/components/dashboard/stat-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { NetWorthHistoryChart } from "@/components/dashboard/net-worth-history-chart";
import { Card, CardLabel } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

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

  // Retorno total = lucro não realizado + dividendos, face ao capital investido.
  const totalReturnEur = breakdown.portfolioPnl + breakdown.totalDividends;
  const totalReturnPct = breakdown.portfolioCost !== 0 ? totalReturnEur / Math.abs(breakdown.portfolioCost) : 0;
  const hasQuotes = breakdown.lastQuoteAt !== null && breakdown.positions.some((p) => p.dayChangeEur !== null);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10 flex flex-col gap-4">
      <HeroCard
        totalNetWorth={breakdown.totalNetWorth}
        dayChangeEur={breakdown.dayChangeEur}
        dayChangePct={breakdown.dayChangePct}
        hasQuotes={hasQuotes}
        totalReturnEur={totalReturnEur}
        totalReturnPct={totalReturnPct}
        dividends={breakdown.totalDividends}
        lastQuoteAt={breakdown.lastQuoteAt}
      />

      {/* Detalhe recolhido por omissão: só abre se quiseres ver a divisão. */}
      <details className="group rounded-2xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-text">
          Detalhe do património
          <ChevronDown size={18} strokeWidth={1.75} className="text-text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pb-4">
          <StatCard label="Contas bancárias" value={breakdown.cashInBanks} />
          <StatCard label="Poupança" value={breakdown.cashInSavings} />
          <StatCard label="Corretoras (saldo livre)" value={breakdown.cashInBrokers} />
          <StatCard label="Numerário" value={breakdown.physicalCash} />
          <StatCard label="Portefólio (valor atual)" value={breakdown.portfolioValue} tone="gold" />
          <StatCard label="Capital investido" value={breakdown.portfolioCost} />
        </div>
      </details>

      <TopMovers positions={breakdown.positions} />

      <Card>
        <p className="text-sm font-medium text-text mb-1">Evolução do património</p>
        <p className="text-xs text-text-faint mb-3">Últimos 90 dias</p>
        <NetWorthHistoryChart snapshots={history} />
      </Card>

      <Card>
        <CardLabel className="mb-4">Distribuição</CardLabel>
        <DonutChart
          slices={slices}
          emptyMessage="Ainda sem saldo registado — adiciona contas e transações para veres a distribuição."
        />
      </Card>
    </div>
  );
}
