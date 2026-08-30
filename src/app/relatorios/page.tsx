import { createClient } from "@/lib/supabase/server";
import { Card, CardLabel } from "@/components/ui/card";
import { PeriodFilter } from "@/components/reports/period-filter";
import { resolvePeriodRange, type PeriodKey } from "@/lib/reports/period";
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Category, Transaction } from "@/types/database";

function groupByCategory(
  rows: Transaction[],
  categoryById: Map<string, Category>
): DonutSlice[] {
  const map = new Map<string, DonutSlice>();
  for (const t of rows) {
    const cat = t.category_id ? categoryById.get(t.category_id) : null;
    const key = cat?.id ?? "sem_categoria";
    const name = cat?.name ?? "Sem categoria";
    const color = cat?.color ?? "#57616F";
    const existing = map.get(key);
    if (existing) {
      existing.value += Number(t.amount);
    } else {
      map.set(key, { name, value: Number(t.amount), color });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = (periodParam ?? "3m") as PeriodKey;
  const { from } = resolvePeriodRange(period);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("occurred_on", from)
      .order("occurred_on", { ascending: false }),
    supabase.from("categories").select("*").eq("user_id", user!.id),
  ]);

  const transactionsList: Transaction[] = transactions ?? [];
  const categoriesList: Category[] = categories ?? [];
  const categoryById = new Map(categoriesList.map((c) => [c.id, c]));

  // Categorias como "Ajuste de Saldo" servem para corrigir/definir saldos
  // manualmente — não são receitas/despesas reais do período, por isso
  // ficam de fora dos totais e dos gráficos dos Relatórios.
  const reportable = transactionsList.filter((t) => {
    const cat = t.category_id ? categoryById.get(t.category_id) : null;
    return !cat?.exclude_from_reports;
  });
  const excludedCount = transactionsList.length - reportable.length;

  const expenses = reportable.filter((t) => t.type === "despesa");
  const income = reportable.filter((t) => t.type === "receita");

  const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalIncome = income.reduce((sum, t) => sum + Number(t.amount), 0);

  const expensesByCategory = groupByCategory(expenses, categoryById);
  const incomeByCategory = groupByCategory(income, categoryById);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">Análise</p>
          <h1 className="font-display text-3xl text-text">Relatórios</h1>
        </div>
        <PeriodFilter active={period} />
      </header>

      {excludedCount > 0 && (
        <p className="text-xs text-text-faint mb-4">
          {excludedCount} movimento(s) de &quot;Ajuste de Saldo&quot; não estão incluídos nestes totais
          (não são receita/despesa real).
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Receitas no período" value={totalIncome} tone="gain" />
        <StatCard label="Despesas no período" value={totalExpenses} tone="loss" />
        <StatCard label="Balanço" value={totalIncome - totalExpenses} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardLabel className="mb-4">Despesas por Categoria</CardLabel>
          <DonutChart
            slices={expensesByCategory}
            emptyMessage="Sem despesas registadas neste período."
          />
        </Card>

        <Card>
          <CardLabel className="mb-4">Receitas por Categoria</CardLabel>
          <DonutChart
            slices={incomeByCategory}
            emptyMessage="Sem receitas registadas neste período."
          />
        </Card>
      </div>
    </div>
  );
}
