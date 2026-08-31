import { createClient } from "@/lib/supabase/server";
import { Card, CardLabel } from "@/components/ui/card";
import { PeriodFilter } from "@/components/reports/period-filter";
import { BudgetForm } from "@/components/reports/budget-form";
import { BudgetList } from "@/components/reports/budget-list";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { resolvePeriodRange, type PeriodKey } from "@/lib/reports/period";
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import type { BudgetStatus, Category, Transaction } from "@/types/database";

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

  const [{ data: transactions }, { data: categories }, { data: budgetStatuses }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("occurred_on", from)
      .order("occurred_on", { ascending: false }),
    supabase.from("categories").select("*").eq("user_id", user!.id),
    supabase.from("budget_status").select("*").eq("user_id", user!.id),
  ]);

  const transactionsList: Transaction[] = transactions ?? [];
  const categoriesList: Category[] = categories ?? [];
  const categoryById = new Map(categoriesList.map((c) => [c.id, c]));
  const budgetStatusesList: BudgetStatus[] = budgetStatuses ?? [];

  const expenses = transactionsList.filter((t) => t.type === "despesa");
  const income = transactionsList.filter((t) => t.type === "receita");

  const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalIncome = income.reduce((sum, t) => sum + Number(t.amount), 0);

  const expensesByCategory = groupByCategory(expenses, categoryById);
  const incomeByCategory = groupByCategory(income, categoryById);

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">Análise</p>
          <h1 className="font-display text-3xl text-text">Relatórios</h1>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <PeriodFilter active={period} />
          <ExportCsvButton transactions={transactionsList} categories={categoriesList} periodLabel={period} />
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Receitas no período" value={totalIncome} tone="gain" />
        <StatCard label="Despesas no período" value={totalExpenses} tone="loss" />
        <StatCard label="Balanço" value={totalIncome - totalExpenses} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

      <Card>
        <CardLabel className="mb-1">Orçamentos Mensais</CardLabel>
        <p className="text-xs text-text-faint mb-4">
          Define um limite de gasto por categoria e acompanha o consumo do mês atual.
        </p>
        <div className="mb-5">
          <BudgetForm categories={categoriesList} />
        </div>
        <div className="ledger-rule pt-4">
          <BudgetList statuses={budgetStatusesList} />
        </div>
      </Card>
    </div>
  );
}
