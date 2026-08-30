import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionList } from "@/components/transactions/transaction-list";
import { CategoryQuickAdd } from "@/components/transactions/category-quick-add";
import { Card, CardLabel } from "@/components/ui/card";
import type { Account, Category, Transaction } from "@/types/database";

export default async function TransacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: accounts }, { data: categories }, { data: transactions }] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user!.id).eq("is_archived", false).order("name"),
    supabase.from("categories").select("*").eq("user_id", user!.id).order("name"),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const accountsList: Account[] = accounts ?? [];
  const categoriesList: Category[] = categories ?? [];
  const transactionsList: Transaction[] = transactions ?? [];

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">Orçamento</p>
        <h1 className="font-display text-3xl text-text">Movimentos</h1>
        <p className="text-sm text-text-muted mt-2">
          Regista receitas, despesas e transferências entre contas. Os saldos das contas
          envolvidas atualizam-se de imediato.
        </p>
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
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <CardLabel>Novo Movimento</CardLabel>
            <CategoryQuickAdd />
          </div>
          <TransactionForm accounts={accountsList} categories={categoriesList} />
        </Card>
      )}

      <Card>
        <CardLabel className="mb-3">Últimos 100 Movimentos</CardLabel>
        <TransactionList transactions={transactionsList} accounts={accountsList} categories={categoriesList} />
      </Card>
    </div>
  );
}
