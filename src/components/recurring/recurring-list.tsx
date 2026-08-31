"use client";

import { useTransition } from "react";
import { Trash2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { toggleRecurringActive, deleteRecurringTransaction } from "@/app/recorrentes/actions";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Account, Category, RecurringTransaction } from "@/types/database";

const FREQUENCY_LABEL: Record<string, string> = {
  diaria: "dia(s)",
  semanal: "semana(s)",
  mensal: "mês(es)",
  anual: "ano(s)",
};

export function RecurringList({
  recurring,
  accounts,
  categories,
}: {
  recurring: RecurringTransaction[];
  accounts: Account[];
  categories: Category[];
}) {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  if (recurring.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">Ainda não tens recorrências configuradas.</p>;
  }

  return (
    <ul className="flex flex-col">
      {recurring.map((r) => (
        <RecurringRow
          key={r.id}
          row={r}
          accountName={accountById.get(r.account_id)?.name ?? "—"}
          categoryName={r.category_id ? categoryById.get(r.category_id)?.name ?? null : null}
        />
      ))}
    </ul>
  );
}

function RecurringRow({
  row,
  accountName,
  categoryName,
}: {
  row: RecurringTransaction;
  accountName: string;
  categoryName: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleRecurringActive(row.id, !row.is_active);
      if (result.error) toast.error(result.error);
      else toast.success(row.is_active ? "Recorrência pausada." : "Recorrência reativada.");
    });
  }

  function handleDelete() {
    if (!confirm("Eliminar esta recorrência? Os movimentos já gerados mantêm-se.")) return;
    startTransition(async () => {
      const result = await deleteRecurringTransaction(row.id);
      if (result.error) toast.error(result.error);
      else toast.success("Recorrência eliminada.");
    });
  }

  const sign = row.type === "receita" ? "+" : row.type === "despesa" ? "-" : "";
  const toneClass = row.type === "receita" ? "text-gain" : row.type === "despesa" ? "text-loss" : "text-text";

  return (
    <li
      className={`flex items-center justify-between gap-3 py-3 border-b border-line-soft last:border-0 ${
        !row.is_active ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text truncate">
          {row.description ||
            categoryName ||
            (row.type === "transferencia" ? "Transferência" : row.type === "receita" ? "Receita" : "Despesa")}
        </p>
        <p className="text-xs text-text-faint mt-0.5">
          A cada {row.interval_count} {FREQUENCY_LABEL[row.frequency]} · {accountName} · próxima em{" "}
          {formatDate(row.next_occurrence)}
        </p>
      </div>
      <span className={`tabular text-sm shrink-0 ${toneClass}`}>
        {sign}
        {formatCurrency(row.amount)}
      </span>
      <button
        onClick={handleToggle}
        disabled={isPending}
        title={row.is_active ? "Pausar" : "Reativar"}
        className="text-text-faint hover:text-gold transition-colors disabled:opacity-50 shrink-0"
      >
        {row.is_active ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Eliminar"
        className="text-text-faint hover:text-loss transition-colors disabled:opacity-50 shrink-0"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>
    </li>
  );
}
