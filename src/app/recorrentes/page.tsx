import { createClient } from "@/lib/supabase/server";
import { Card, CardLabel } from "@/components/ui/card";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { RecurringList } from "@/components/recurring/recurring-list";
import type { Account, Category, RecurringTransaction } from "@/types/database";

export default async function RecorrentesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Garante que qualquer recorrência vencida já gerou os movimentos
  // correspondentes antes de mostrarmos a lista.
  await supabase.rpc("apply_due_recurring_transactions", { p_user_id: user!.id });

  const [{ data: accounts }, { data: categories }, { data: recurring }] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user!.id).eq("is_archived", false).order("name"),
    supabase.from("categories").select("*").eq("user_id", user!.id).order("name"),
    supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", user!.id)
      .order("next_occurrence", { ascending: true }),
  ]);

  const accountsList: Account[] = accounts ?? [];
  const categoriesList: Category[] = categories ?? [];
  const recurringList: RecurringTransaction[] = recurring ?? [];

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">Orçamento</p>
        <h1 className="font-display text-3xl text-text">Recorrências</h1>
        <p className="text-sm text-text-muted mt-2">
          Renda, salário, subscrições — regista uma vez e os movimentos são gerados
          automaticamente em cada período, sem teres de repetir o registo manualmente.
        </p>
      </header>

      {accountsList.length === 0 ? (
        <Card className="mb-8">
          <p className="text-sm text-text-muted">
            Precisas de pelo menos uma conta antes de criares uma recorrência.{" "}
            <a href="/contas" className="text-gold underline underline-offset-2">
              Cria uma conta
            </a>
            .
          </p>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardLabel className="mb-3">Nova Recorrência</CardLabel>
          <RecurringForm accounts={accountsList} categories={categoriesList} />
        </Card>
      )}

      <Card>
        <CardLabel className="mb-3">As Tuas Recorrências</CardLabel>
        <RecurringList recurring={recurringList} accounts={accountsList} categories={categoriesList} />
      </Card>
    </div>
  );
}
