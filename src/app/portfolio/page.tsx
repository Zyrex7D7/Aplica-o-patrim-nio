import { createClient } from "@/lib/supabase/server";
import { Card, CardLabel } from "@/components/ui/card";
import { DegiroUpload } from "@/components/portfolio/degiro-upload";
import { RefreshQuotesButton } from "@/components/portfolio/refresh-quotes-button";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import type { Account } from "@/types/database";

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

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">Investimentos</p>
        <h1 className="font-display text-3xl text-text">Portefólio</h1>
        <p className="text-sm text-text-muted mt-2">
          Importa o extrato de transações da DEGIRO (formato europeu, com vírgulas decimais) e
          acompanha o valor atual e o lucro ou prejuízo de cada posição.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Capital investido" value={breakdown.portfolioCost} />
        <StatCard label="Valor atual" value={breakdown.portfolioValue} tone="gold" />
        <StatCard
          label="Lucro / Prejuízo"
          value={breakdown.portfolioPnl}
          tone={breakdown.portfolioPnl >= 0 ? "gain" : "loss"}
        />
      </div>

      <Card className="mb-8">
        <CardLabel className="mb-3">Importar Extrato DEGIRO</CardLabel>
        <DegiroUpload brokerAccounts={brokerAccounts} />
      </Card>

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
