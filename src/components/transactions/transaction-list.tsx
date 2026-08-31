"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTransaction } from "@/app/transacoes/actions";
import { EditTransactionDialog } from "@/components/transactions/edit-transaction-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Account, Category, Transaction } from "@/types/database";

interface Row extends Transaction {
  accountName: string;
  transferAccountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  excludedFromReports: boolean;
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const label = d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function TransactionList({
  transactions,
  accounts,
  categories,
}: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
}) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const rows: Row[] = transactions.map((t) => {
    const cat = t.category_id ? categoryById.get(t.category_id) : null;
    return {
      ...t,
      accountName: accountById.get(t.account_id)?.name ?? "—",
      transferAccountName: t.transfer_account_id
        ? accountById.get(t.transfer_account_id)?.name ?? "—"
        : null,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      excludedFromReports: cat?.exclude_from_reports ?? false,
    };
  });

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">Nenhum movimento encontrado.</p>;
  }

  // Agrupa por mês (assume que `rows` já vem ordenado por data decrescente).
  const groups: { label: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const label = monthLabel(row.occurred_on);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.rows.push(row);
    } else {
      groups.push({ label, rows: [row] });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const income = group.rows
          .filter((r) => r.type === "receita" && !r.excludedFromReports)
          .reduce((sum, r) => sum + Number(r.amount), 0);
        const expense = group.rows
          .filter((r) => r.type === "despesa" && !r.excludedFromReports)
          .reduce((sum, r) => sum + Number(r.amount), 0);

        return (
          <div key={group.label}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint">{group.label}</p>
              <p className="text-xs tabular text-text-faint">
                {income > 0 && <span className="text-gain">+{formatCurrency(income)}</span>}
                {income > 0 && expense > 0 && <span className="mx-1">·</span>}
                {expense > 0 && <span className="text-loss">-{formatCurrency(expense)}</span>}
              </p>
            </div>
            <ul className="flex flex-col">
              {group.rows.map((t) => (
                <TransactionRow key={t.id} row={t} accounts={accounts} categories={categories} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function TransactionRow({
  row,
  accounts,
  categories,
}: {
  row: Row;
  accounts: Account[];
  categories: Category[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Eliminar este movimento?")) return;
    startTransition(async () => {
      try {
        await deleteTransaction(row.id);
        toast.success("Movimento eliminado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao eliminar movimento.");
      }
    });
  }

  const sign = row.type === "receita" ? "+" : row.type === "despesa" ? "-" : "";
  const toneClass =
    row.type === "receita" ? "text-gain" : row.type === "despesa" ? "text-loss" : "text-text";

  return (
    <li className="flex items-center justify-between gap-3 py-3 border-b border-line-soft last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {row.categoryColor && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: row.categoryColor }}
            />
          )}
          <p className="text-sm text-text truncate">
            {row.description ||
              row.categoryName ||
              (row.type === "transferencia" ? "Transferência" : row.type === "receita" ? "Receita" : "Despesa")}
          </p>
          {row.excludedFromReports && (
            <span className="text-[10px] uppercase tracking-wide text-text-faint border border-line-soft rounded px-1.5 py-0.5 shrink-0">
              Ajuste
            </span>
          )}
        </div>
        <p className="text-xs text-text-faint mt-0.5">
          {formatDate(row.occurred_on)} · {row.accountName}
          {row.transferAccountName ? ` → ${row.transferAccountName}` : ""}
          {row.categoryName ? ` · ${row.categoryName}` : ""}
        </p>
      </div>
      <span className={`tabular text-sm shrink-0 ${toneClass}`}>
        {sign}
        {formatCurrency(row.amount)}
      </span>
      <EditTransactionDialog transaction={row} accounts={accounts} categories={categories} />
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-text-faint hover:text-loss transition-colors disabled:opacity-50 shrink-0"
        title="Eliminar"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>
    </li>
  );
}
