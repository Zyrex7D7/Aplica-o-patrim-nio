import { createClient } from "@/lib/supabase/server";
import { Card, CardLabel } from "@/components/ui/card";
import { DegiroUpload } from "@/components/portfolio/degiro-upload";
import { RefreshQuotesButton } from "@/components/portfolio/refresh-quotes-button";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { PerformanceHighlights } from "@/components/portfolio/performance-highlights";
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatPercent } from "@/lib/format";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import type { Account } from "@/types/database";

const PALETTE = [
  "var(--color-gold)",
  "var(--color-gain)",
  "var(--color-info)",
  "#B48CE0",
  "#F2789F",
  "#5EC8D8",
  "#D9A441",
];

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: accounts }, breakdown] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user!.id).eq("is_archived", false),
    getNetWorthBreakdown(supabase, user!.id),
  ]);

  const brokerAccounts: Account[] = (accounts ?? []).filter((a: Account) => a.type === "corretora");
  const freeCash = brokerAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

  const totalDividends = breakdown.positions.reduce((sum, p) => sum + Number(p.total_dividends), 0);
  const totalFees = breakdown.positions.reduce((sum, p) => sum + Math.abs(Number(p.total_fees ?? 0)), 0);
  const totalTrades = breakdown.positions.reduce((sum, p) => sum + Number(p.trade_count ?? 0), 0);
  const performancePct =
    breakdown.portfolioCost !== 0 ? breakdown.portfolioPnl / breakdown.portfolioCost : 0;
  const totalReturnPct =
    breakdown.portfolioCost !== 0
      ? (breakdown.portfolioPnl + totalDividends) / breakdown.portfolioCost
      : 0;

  const compositionSlices: DonutSlice[] = [...breakdown.positions]
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((p, i) => ({
      name: p.name,
      value: p.marketValue,
      color: PALETTE[i % PALETTE.length],
    }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">Investimentos</p>
        <h1 className="font-display text-3xl text-text">Portefólio</h1>
        <p className="text-sm text-text-muted mt-2">
          Importa o extrato de transações da DEGIRO (formato europeu, com vírgulas decimais) e
          acompanha o valor atual e o lucro ou prejuízo de cada posição.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <StatCard label="Capital investido" value={breakdown.portfolioCost} />
        <StatCard label="Valor atual" value={breakdown.portfolioValue} tone="gold" />
        <StatCard
          label="Lucro / Prejuízo"
          value={breakdown.portfolioPnl}
          tone={breakdown.portfolioPnl >= 0 ? "gain" : "loss"}
        />
        <StatCard label="Dividendos Recebidos" value={totalDividends} tone="gain" />
        <StatCard label="Comissões Pagas" value={totalFees} tone="loss" />
        <StatCard label="Saldo livre (à espera de investir)" value={freeCash} />
      </div>

      <Card className="mb-8">
        <CardLabel className="mb-3">Importar Extrato DEGIRO</CardLabel>
        <DegiroUpload brokerAccounts={brokerAccounts} />
      </Card>

      {breakdown.positions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          <Card className="lg:col-span-3">
            <CardLabel className="mb-4">Composição do Portefólio</CardLabel>
            <DonutChart slices={compositionSlices} />
          </Card>

          <Card className="lg:col-span-2 flex flex-col justify-between">
            <div>
              <CardLabel className="mb-3">Desempenho Global</CardLabel>
              <p
                className={`font-display text-4xl tabular ${
                  performancePct >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {formatPercent(performancePct)}
              </p>
              <p className="text-xs text-text-faint mt-2">
                Lucro/prejuízo não realizado face ao capital investido.
              </p>
              <div className="ledger-rule mt-4 pt-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint">
                  Retorno Total (com dividendos)
                </p>
                <p
                  className={`tabular text-xl mt-1 ${
                    totalReturnPct >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {formatPercent(totalReturnPct)}
                </p>
              </div>
              {totalTrades > 0 && (
                <p className="text-xs text-text-faint mt-2">
                  {totalTrades} transaç{totalTrades === 1 ? "ão" : "ões"} de compra/venda registada
                  {totalTrades === 1 ? "" : "s"}.
                </p>
              )}
            </div>
            <div className="mt-6">
              <PerformanceHighlights positions={breakdown.positions} />
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardLabel>Posições Atuais</CardLabel>
          <RefreshQuotesButton />
        </div>
        <HoldingsTable positions={breakdown.positions} />
      </Card>
    </div>
  );
}
