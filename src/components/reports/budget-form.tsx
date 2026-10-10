"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { upsertBudget } from "@/app/relatorios/actions";
import type { Category } from "@/types/database";

export function BudgetForm({ categories }: { categories: Category[] }) {
  const [isPending, startTransition] = useTransition();
  const expenseCategories = categories.filter((c) => c.kind === "despesa" && !c.exclude_from_reports);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await upsertBudget(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      form.reset();
      toast.success("Orçamento guardado.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <select
        name="category_id"
        required
        className="flex-1 rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
      >
        <option value="">Categoria</option>
        {expenseCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        name="monthly_limit"
        required
        placeholder="Limite mensal"
        inputMode="decimal"
        className="sm:w-40 rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "A guardar..." : "Definir Orçamento"}
      </button>
    </form>
  );
}
