import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import { getNetWorthHistory } from "@/lib/data/net-worth-history";
import { shortTicker } from "@/lib/ticker";
import { HeroCard } from "@/components/dashboard/hero-card";
import { TopMovers } from "@/components/dashboard/top-movers";
import { RecordCard } from "@/components/dashboard/record-card";
import { ReturnChart } from "@/components/dashboard/return-chart";
import { WeightTreemap } from "@/components/dashboard/weight-treemap";
import { BestWorst } from "@/components/dashboard/best-worst";
import { StatCard } from "@/components/dashboard/stat-card";
import { DonutChart } from "@/components/charts/donut-chart";

const PALETTE = ["#4C8DF6", "#2FD27F", "#B48CE0", "#F2B84B", "#5EC8D8", "#F2789F", "#8D9AB5"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [b, history] = await Promise.all([
    getNetWorthBreakdown(supabase, user!.id),
    getNetWorthHistory(supabase, user!.id, 3650),
  ]);

  const totalReturnEur = b.portfolioPnl + b.totalDividends;
  const totalReturnPct = b.portfolioCost !== 0 ? totalReturnEur / Math.abs(b.portfolioCost) : 0;
  const hasQuotes = b.lastQuoteAt !== null && b.positions.some((p) => p.dayChangeEur !== null);

  const treemapItems = b.positions
    .filter((p) => p.marketValue > 0)
    .map((p) => ({
      name: shortTicker(p.symbol, p.name),
      size: p.marketValue,
      ret: p.net_invested !== 0 ? ((p.marketValue - p.net_invested) / Math.abs(p.net_invested)) * 100 : 0,
    }));

  const allocation = [
    ...[...b.positions]
      .sort((a, c) => c.marketValue - a.marketValue)
      .map((p, i) => ({ name: shortTicker(p.symbol, p.name), value: p.marketValue, color: PALETTE[i % PALETTE.length] })),
    { name: "Contas e liquidez", value: b.cashInBanks + b.cashInSavings + b.cashInBrokers + b.physicalCash, color: "#5F6E8D" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 md:py-10 flex flex-col gap-4">
      <HeroCard
        totalNetWorth={b.totalNetWorth}
        dayChangeEur={b.dayChangeEur}
        dayChangePct={b.dayChangePct}
        hasQuotes={hasQuotes}
        totalReturnEur={totalReturnEur}
        totalReturnPct={totalReturnPct}
        dividends={b.totalDividends}
        lastQuoteAt={b.lastQuoteAt}
      />

      <details className="group rounded-3xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-base font-bold text-text">
          Detalhe do património
          <ChevronDown size={20} className="text-text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          <StatCard label="Contas bancárias" value={b.cashInBanks} />
          <StatCard label="Poupança" value={b.cashInSavings} />
          <StatCard label="Corretoras (livre)" value={b.cashInBrokers} />
          <StatCard label="Numerário" value={b.physicalCash} />
          <StatCard label="Portefólio" value={b.portfolioValue} tone="gold" />
          <StatCard label="Capital investido" value={b.portfolioCost} />
        </div>
      </details>

      <TopMovers positions={b.positions} />
      <RecordCard current={b.totalNetWorth} snapshots={history} />
      <ReturnChart snapshots={history} />
      <WeightTreemap items={treemapItems} />

      <section className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="text-base font-bold text-text mb-4">Distribuição</h2>
        <DonutChart slices={allocation} emptyMessage="Ainda sem saldo registado." />
      </section>

      <BestWorst positions={b.positions} />
    </div>
  );
}
