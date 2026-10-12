import { createClient } from "@/lib/supabase/server";
import { QuickEntry } from "@/components/transactions/quick-entry";
import { TransactionList } from "@/components/transactions/transaction-list";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { CategoryQuickAdd } from "@/components/transactions/category-quick-add";
import { CategoryManager } from "@/components/transactions/category-manager";
import { CategoryRulesManager } from "@/components/transactions/category-rules-manager";
import { Card, CardLabel } from "@/components/ui/card";
import type { Account, Category, CategoryRule, Transaction } from "@/types/database";

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; account?: string; category?: string }>;
}) {
  const { q, account, category } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gera automaticamente qualquer movimento recorrente que já esteja
  // vencido (renda, salário, subscrições...) antes de mostrar a lista.
  await supabase.rpc("apply_due_recurring_transactions", { p_user_id: user!.id });

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user!.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  // Sem filtros: mantém o limite original de 100 para não sobrecarregar a
  // página; com filtros, alarga-se para a pesquisa realmente encontrar o
  // movimento pretendido em vez de ficar escondido fora da 1ª página.
  const hasFilters = Boolean(q || account || category);
  query = query.limit(hasFilters ? 500 : 100);

  if (account) query = query.eq("account_id", account);
  if (category) query = query.eq("category_id", category);
  if (q) query = query.ilike("description", `%${q}%`);

  const [{ data: accounts }, { data: categories }, { data: rules }, { data: transactions }, { data: recent }] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user!.id).eq("is_archived", false).order("name"),
      supabase.from("categories").select("*").eq("user_id", user!.id).order("name"),
      supabase.from("category_rules").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      query,
      // categorias mais usadas (independente dos filtros), para aparecerem primeiro no registo rápido
      supabase.from("transactions").select("category_id").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(300),
    ]);

  const accountsList: Account[] = accounts ?? [];
  const categoriesList: Category[] = categories ?? [];
  const rulesList: CategoryRule[] = rules ?? [];
  const transactionsList: Transaction[] = transactions ?? [];

  const usage: Record<string, number> = {};
  for (const t of (recent ?? []) as { category_id: string | null }[]) {
    if (t.category_id) usage[t.category_id] = (usage[t.category_id] ?? 0) + 1;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">Orçamento</p>
          <h1 className="font-display text-3xl text-text">Movimentos</h1>
          <p className="text-sm text-text-muted mt-2">
            Regista receitas, despesas e transferências entre contas. Os saldos das contas
            envolvidas atualizam-se de imediato. Em qualquer página, o botão + faz o mesmo.
          </p>
        </div>
        <a
          href="/recorrentes"
          className="shrink-0 text-xs text-gold underline underline-offset-2 whitespace-nowrap"
        >
          Ver recorrências
        </a>
      </header>

      {accountsList.length === 0 ? (
        <Card className="mb-8">
          <p className="text-sm text-text-muted">
            Precisas de pelo menos uma conta antes de registares movimentos.{" "}
            <a href="/contas" className="text-gold underline underline-offset-2">
              Cria uma conta
            </a>
            .
          </p>
        </Card>
      ) : (
        <Card className="mb-8 max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <CardLabel>Novo Movimento</CardLabel>
            <CategoryQuickAdd />
          </div>
          <QuickEntry accounts={accountsList} categories={categoriesList} usage={usage} />
        </Card>
      )}

      <Card className="mb-8">
        <CardLabel className="mb-3">Categorias</CardLabel>
        <CategoryManager categories={categoriesList} />
        <CategoryRulesManager rules={rulesList} categories={categoriesList} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardLabel>{hasFilters ? "Movimentos Filtrados" : "Últimos 100 Movimentos"}</CardLabel>
        </div>
        <TransactionFilters accounts={accountsList} categories={categoriesList} />
        <TransactionList transactions={transactionsList} accounts={accountsList} categories={categoriesList} />
      </Card>
    </div>
  );
}
