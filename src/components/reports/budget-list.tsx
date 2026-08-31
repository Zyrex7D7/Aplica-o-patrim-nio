"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBudget } from "@/app/relatorios/actions";
import { formatCurrency } from "@/lib/format";
import type { BudgetStatus } from "@/types/database";

export function BudgetList({ statuses }: { statuses: BudgetStatus[] }) {
  if (statuses.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">Ainda não definiste orçamentos.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {statuses.map((s) => (
        <BudgetRow key={s.category_id} status={s} />
      ))}
    </ul>
  );
}

function BudgetRow({ status }: { status: BudgetStatus }) {
  const [isPending, startTransition] = useTransition();
  const pct = status.monthly_limit > 0 ? Math.min(100, (status.spent_this_month / status.monthly_limit) * 100) : 0;
  const over = status.spent_this_month > status.monthly_limit;

  function handleDelete() {
    if (!confirm(`Remover o orçamento de "${status.category_name}"?`)) return;
    startTransition(async () => {
      const result = await deleteBudget(status.category_id);
      if (result.error) toast.error(result.error);
      else toast.success("Orçamento removido.");
    });
  }

  return (
    <li>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-2 text-sm text-text">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: status.category_color ?? "#8B93A1" }}
          />
          {status.category_name}
        </span>
        <span className="flex items-center gap-3">
          <span className={`tabular text-xs ${over ? "text-loss" : "text-text-muted"}`}>
            {formatCurrency(status.spent_this_month)} / {formatCurrency(status.monthly_limit)}
          </span>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-text-faint hover:text-loss transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-alt overflow-hidden">
        <div className={`h-full rounded-full ${over ? "bg-loss" : "bg-gold"}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
