import { createClient } from "@/lib/supabase/server";
import { Card, CardLabel } from "@/components/ui/card";
import { DegiroUpload } from "@/components/portfolio/degiro-upload";
import { RefreshQuotesButton } from "@/components/portfolio/refresh-quotes-button";
import { UndoImportButton } from "@/components/portfolio/undo-import-button";
import { WipeImportsButton } from "@/components/portfolio/wipe-imports-button";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { PerformanceHighlights } from "@/components/portfolio/performance-highlights";
import { PortfolioTabs } from "@/components/portfolio/portfolio-tabs";
import { PortfolioProjections } from "@/components/portfolio/portfolio-projections";
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import { getNetWorthHistory } from "@/lib/data/net-worth-history";
import { estimateAnnualGrowthRate } from "@/lib/reports/projections";
import type { Account, RealizedPnlRow } from "@/types/database";

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

  const [{ data: accounts }, breakdown, { data: realizedRows }, history] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user!.id).eq("is_archived", false),
    getNetWorthBreakdown(supabase, user!.id),
    supabase.rpc("get_realized_pnl", { p_user_id: user!.id }),
    // Vai buscar o máximo de histórico disponível (a tabela só tem os dias
    // que já foram capturados, por isso pedir "10 anos" é seguro mesmo que
    // só existam 2 semanas de dados reais).
    getNetWorthHistory(supabase, user!.id, 3650),
  ]);

  const brokerAccounts: Account[] = (accounts ?? []).filter((a: Account) => a.type === "corretora");
  const freeCash = brokerAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

  // "Dinheiro total nas corretoras": o que está investido em ações +
  // o saldo livre que ainda não foi investido.
  const totalNasCorretoras = breakdown.portfolioValue + freeCash;

  const totalDividends = breakdown.positions.reduce((sum, p) => sum + Number(p.total_dividends), 0);
  const totalFees = breakdown.positions.reduce((sum, p) => sum + Number(p.total_fees), 0);
  const performancePct =
    breakdown.portfolioCost !== 0 ? breakdown.portfolioPnl / breakdown.portfolioCost : 0;
  const totalRealizedPnl = ((realizedRows ?? []) as RealizedPnlRow[]).reduce(
    (sum, r) => sum + Number(r.realized_pnl),
    0
  );

  const estimatedAnnualRatePct = estimateAnnualGrowthRate(history);

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

      {/* Dinheiro total nas corretoras — em destaque, ao estilo do total do Dashboard. */}
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">
          Dinheiro Total nas Corretoras
        </p>
        <p className="font-display text-3xl sm:text-4xl md:text-5xl tabular text-gold break-words">
          {formatCurrency(totalNasCorretoras)}
        </p>
        <p className="text-sm text-text-muted mt-2">
          Valor atual das ações ({formatCurrency(breakdown.portfolioValue)}) + saldo livre à espera
          de ser investido ({formatCurrency(freeCash)}).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        <StatCard label="Capital investido" value={breakdown.portfolioCost} />
        <StatCard label="Valor atual" value={breakdown.portfolioValue} tone="gold" />
        <StatCard
          label="Lucro / Prejuízo (não realizado)"
          value={breakdown.portfolioPnl}
          tone={breakdown.portfolioPnl >= 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Lucro Realizado"
          value={totalRealizedPnl}
          tone={totalRealizedPnl >= 0 ? "gain" : "loss"}
          hint="Ganhos/perdas já vendidos, custo médio"
        />
        <StatCard label="Dividendos Recebidos" value={totalDividends} tone="gain" />
        <StatCard label="Comissões e Taxas Pagas" value={totalFees} tone="loss" />
        <StatCard label="Saldo livre (à espera de investir)" value={freeCash} />
      </div>

      <Card className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <CardLabel>Importar Extrato DEGIRO</CardLabel>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <UndoImportButton />
            <WipeImportsButton />
          </div>
        </div>
        <DegiroUpload brokerAccounts={brokerAccounts} />
      </Card>

      <PortfolioTabs
        overview={
          <>
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
                      className={`font-display text-3xl sm:text-4xl tabular break-words ${
                        performancePct >= 0 ? "text-gain" : "text-loss"
                      }`}
                    >
                      {formatPercent(performancePct)}
                    </p>
                    <p className="text-xs text-text-faint mt-2">
                      Lucro/prejuízo não realizado face ao capital investido.
                    </p>
                  </div>
                  <div className="mt-6">
                    <PerformanceHighlights positions={breakdown.positions} />
                  </div>
                </Card>
              </div>
            )}

            <Card>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <CardLabel>Posições Atuais</CardLabel>
                <RefreshQuotesButton />
              </div>
              <HoldingsTable positions={breakdown.positions} />
            </Card>
          </>
        }
        projections={
          <Card>
            <CardLabel className="mb-1">Projeções do Portefólio</CardLabel>
            <p className="text-xs text-text-faint mb-4">
              Simulação da evolução do teu portefólio ao longo do tempo, com base numa taxa de
              retorno anual que podes ajustar.
            </p>
            <PortfolioProjections
              currentValue={breakdown.portfolioValue}
              estimatedAnnualRatePct={estimatedAnnualRatePct}
            />
          </Card>
        }
      />
    </div>
  );
}
