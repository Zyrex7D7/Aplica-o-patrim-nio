"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTransaction } from "@/app/transacoes/actions";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Account, Category, Transaction } from "@/types/database";

interface Row extends Transaction {
  accountName: string;
  transferAccountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
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

  const rows: Row[] = transactions.map((t) => ({
    ...t,
    accountName: accountById.get(t.account_id)?.name ?? "—",
    transferAccountName: t.transfer_account_id ? accountById.get(t.transfer_account_id)?.name ?? "—" : null,
    categoryName: t.category_id ? categoryById.get(t.category_id)?.name ?? null : null,
    categoryColor: t.category_id ? categoryById.get(t.category_id)?.color ?? null : null,
  }));

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">Ainda não há movimentos registados.</p>;
  }

  return (
    <ul className="flex flex-col">
      {rows.map((t) => (
        <TransactionRow key={t.id} row={t} />
      ))}
    </ul>
  );
}

function TransactionRow({ row }: { row: Row }) {
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
