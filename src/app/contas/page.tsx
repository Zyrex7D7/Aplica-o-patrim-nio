import { createClient } from "@/lib/supabase/server";
import { getNetWorthBreakdown } from "@/lib/data/net-worth";
import { getInvestedByAccount } from "@/lib/data/account-values";
import { AccountForm } from "@/components/accounts/account-form";
import { ArchiveAccountButton } from "@/components/accounts/archive-account-button";
import { DeleteAccountButton } from "@/components/accounts/delete-account-button";
import { EditAccountDialog } from "@/components/accounts/edit-account-dialog";
import { Card, CardLabel } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Account } from "@/types/database";

const TYPE_LABEL: Record<Account["type"], string> = {
  banco: "Banco",
  poupanca: "Poupança",
  corretora: "Corretora",
  numerario: "Numerário",
};

export default async function ContasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: accounts }, breakdown] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_archived", false)
      .order("type")
      .order("name"),
    getNetWorthBreakdown(supabase, user!.id),
  ]);

  const list: Account[] = accounts ?? [];
  const brokerIds = list.filter((a) => a.type === "corretora").map((a) => a.id);
  const investedByAccount = await getInvestedByAccount(supabase, user!.id, brokerIds, breakdown.positions);

  // Corretora = tudo o que tens lá: ações/ETFs ao preço atual + saldo livre à espera de investir.
  const rows = list.map((a) => {
    const invested = investedByAccount.get(a.id) ?? 0;
    const cash = Number(a.current_balance);
    return { account: a, invested, cash, total: cash + invested };
  });
  const total = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-10">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">
          Liquidez
        </p>
        <h1 className="font-display text-3xl text-text">Contas</h1>
        <p className="text-sm text-text-muted mt-2">
          Bancos, corretoras e numerário. Os saldos atualizam-se automaticamente com as
          receitas, despesas e transações de investimento que registares.
        </p>
      </header>

      <Card className="mb-8">
        <CardLabel className="mb-3">Nova Conta</CardLabel>
        <AccountForm />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardLabel>As Tuas Contas</CardLabel>
          <span className="tabular text-sm text-text-muted">
            Total: <span className="text-text font-medium">{formatCurrency(total)}</span>
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-text-muted py-6 text-center">
            Ainda não tens contas. Cria a primeira acima.
          </p>
        ) : (
          <ul className="flex flex-col">
            {rows.map(({ account: a, invested, cash, total: accountTotal }) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-3 border-b border-line-soft last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text truncate">{a.name}</p>
                  <p className="text-xs text-text-faint mt-0.5">
                    {TYPE_LABEL[a.type]}
                    {a.institution ? ` · ${a.institution}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="tabular text-sm text-text">{formatCurrency(accountTotal, a.currency)}</span>
                    {a.type === "corretora" && (
                      <p className="text-[11px] text-text-faint tabular mt-0.5">
                        {formatCurrency(invested)} investido · {formatCurrency(cash)} livre
                      </p>
                    )}
                  </div>
                  <EditAccountDialog account={a} />
                  <ArchiveAccountButton accountId={a.id} />
                  <DeleteAccountButton accountId={a.id} accountName={a.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
