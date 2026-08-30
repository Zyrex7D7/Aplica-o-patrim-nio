import { createClient } from "@/lib/supabase/server";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import { StatCard } from "@/components/dashboard/stat-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { Card, CardLabel } from "@/components/ui/card";
import { formatCurrency, formatSignedCurrency, formatDate } from "@/lib/format";
import type { Account, Category, Transaction } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [breakdown, { data: recentTx }, { data: accounts }, { data: categories }] = await Promise.all([
    getNetWorthBreakdown(supabase, user!.id),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("accounts").select("*").eq("user_id", user!.id),
    supabase.from("categories").select("*").eq("user_id", user!.id),
  ]);

  const accountById = new Map((accounts ?? []).map((a: Account) => [a.id, a]));
  const categoryById = new Map((categories ?? []).map((c: Category) => [c.id, c]));
  const recentTransactions: Transaction[] = recentTx ?? [];

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
        <p className="font-display text-5xl tabular text-text">
          {formatCurrency(breakdown.totalNetWorth)}
        </p>
        <p className="text-sm text-text-muted mt-2">
          Soma de contas bancárias, poupança, saldo livre em corretoras, numerário e valor atual
          do portefólio de investimentos.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-10">
        <StatCard label="Contas Bancárias" value={breakdown.cashInBanks} />
        <StatCard label="Poupança" value={breakdown.cashInSavings} />
        <StatCard label="Corretoras (saldo livre)" value={breakdown.cashInBrokers} />
        <StatCard label="Numerário" value={breakdown.physicalCash} />
        <StatCard label="Portefólio (valor atual)" value={breakdown.portfolioValue} tone="gold" />
      </div>

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
            <div>
              <p className="text-xs text-text-faint">Capital investido</p>
              <p className="tabular text-xl text-text mt-1">{formatCurrency(breakdown.portfolioCost)}</p>
            </div>
            <div>
              <p className="text-xs text-text-faint">Lucro / Prejuízo não realizado</p>
              <p
                className={`tabular text-xl mt-1 ${
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
                    className="flex items-center justify-between text-sm py-1.5 border-b border-line-soft last:border-0"
                  >
                    <span className="text-text">{p.name}</span>
                    <span className="tabular text-text-muted">
                      {p.quantity_held.toLocaleString("pt-PT")} un.
                    </span>
                    <span className="tabular text-text">{formatCurrency(p.marketValue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <CardLabel>Últimos Movimentos</CardLabel>
          <a href="/transacoes" className="text-xs text-gold hover:underline underline-offset-2">
            Ver todos
          </a>
        </div>
        {recentTransactions.length === 0 ? (
          <p className="text-sm text-text-muted">
            Ainda não há movimentos registados.{" "}
            <a href="/transacoes" className="text-gold underline underline-offset-2">
              Regista o primeiro
            </a>
            .
          </p>
        ) : (
          <ul className="flex flex-col">
            {recentTransactions.map((t) => {
              const account = accountById.get(t.account_id);
              const category = t.category_id ? categoryById.get(t.category_id) : null;
              const sign = t.type === "receita" ? "+" : t.type === "despesa" ? "-" : "";
              const toneClass =
                t.type === "receita" ? "text-gain" : t.type === "despesa" ? "text-loss" : "text-text";
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text truncate">
                      {t.description ||
                        category?.name ||
                        (t.type === "transferencia" ? "Transferência" : t.type === "receita" ? "Receita" : "Despesa")}
                    </p>
                    <p className="text-xs text-text-faint mt-0.5">
                      {formatDate(t.occurred_on)} · {account?.name ?? "—"}
                    </p>
                  </div>
                  <span className={`tabular text-sm shrink-0 ${toneClass}`}>
                    {sign}
                    {formatCurrency(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
