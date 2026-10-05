import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import { getQuote } from "@/lib/market/quotes";
import { DegiroUpload } from "@/components/portfolio/degiro-upload";
import { RefreshQuotesButton } from "@/components/portfolio/refresh-quotes-button";
import { UndoImportButton } from "@/components/portfolio/undo-import-button";
import { WipeImportsButton } from "@/components/portfolio/wipe-imports-button";
import { HoldingsTable, type ClosedRow } from "@/components/portfolio/holdings-table";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Account, RealizedPnlRow } from "@/types/database";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: accounts }, b, { data: realizedRows }, { data: closedPositions }, sp500] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user!.id).eq("is_archived", false),
    getNetWorthBreakdown(supabase, user!.id),
    supabase.rpc("get_realized_pnl", { p_user_id: user!.id }),
    supabase.from("portfolio_positions").select("*").eq("user_id", user!.id).lte("quantity_held", 0.0000001),
    getQuote("^GSPC"),
  ]);

  const brokerAccounts: Account[] = (accounts ?? []).filter((a: Account) => a.type === "corretora");
  const freeCash = brokerAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0);
  const totalFees = b.positions.reduce((sum, p) => sum + Number(p.total_fees), 0);

  const realized = (realizedRows ?? []) as RealizedPnlRow[];
  const realizedById = new Map(realized.map((r) => [r.asset_id, Number(r.realized_pnl)]));
  const totalRealized = realized.reduce((s, r) => s + Number(r.realized_pnl), 0);

  const closed: ClosedRow[] = (closedPositions ?? []).map(
    (p: { asset_id: string; name: string; symbol: string | null; total_dividends: number }) => ({
      asset_id: p.asset_id,
      name: p.name,
      symbol: p.symbol,
      realizedPnl: realizedById.get(p.asset_id) ?? 0,
      total_dividends: Number(p.total_dividends),
    })
  );

  const hasQuotes = b.positions.some((p) => p.dayChangeEur !== null);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 md:py-10 flex flex-col gap-4">
      <div className="flex justify-end">
        <RefreshQuotesButton />
      </div>

      <HoldingsTable
        positions={b.positions}
        closed={closed}
        portfolioDayPct={hasQuotes ? b.dayChangePct : null}
        benchmarkPct={sp500?.changePercent != null ? sp500.changePercent / 100 : null}
      />

      <details className="group rounded-3xl border border-line bg-surface mt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-base font-bold text-text">
          Estatísticas da carteira
          <ChevronDown size={20} className="text-text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          <StatCard label="Capital investido" value={b.portfolioCost} />
          <StatCard label="Valor atual" value={b.portfolioValue} tone="gold" />
          <StatCard label="Lucro não realizado" value={b.portfolioPnl} tone={b.portfolioPnl >= 0 ? "gain" : "loss"} />
          <StatCard label="Lucro realizado" value={totalRealized} tone={totalRealized >= 0 ? "gain" : "loss"} />
          <StatCard label="Dividendos" value={b.totalDividends} tone="gain" />
          <StatCard label="Comissões e taxas" value={totalFees} tone="loss" />
          <StatCard label="Saldo livre" value={freeCash} />
        </div>
      </details>

      <details className="group rounded-3xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-base font-bold text-text">
          Importar extrato DEGIRO
          <ChevronDown size={20} className="text-text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-5 pb-5 flex flex-col gap-4">
          <DegiroUpload brokerAccounts={brokerAccounts} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <UndoImportButton />
            <WipeImportsButton />
            <Link href="/portfolio/importacoes" className="text-xs text-gold">
              Ver histórico de importações
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}
