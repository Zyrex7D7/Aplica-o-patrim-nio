"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { upsertBudget } from "@/app/relatorios/actions";
import type { Category } from "@/types/database";

export function BudgetForm({ categories }: { categories: Category[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const expenseCategories = categories.filter((c) => c.kind === "despesa");

  async function action(formData: FormData) {
    startTransition(async () => {
      const result = await upsertBudget(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      formRef.current?.reset();
      toast.success("Orçamento guardado.");
    });
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col sm:flex-row gap-3">
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
