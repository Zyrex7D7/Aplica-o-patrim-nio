"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createRecurringTransaction } from "@/app/recorrentes/actions";
import { todayLocalISO } from "@/lib/dates";
import type { Account, Category } from "@/types/database";

export function RecurringForm({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [type, setType] = useState<"receita" | "despesa" | "transferencia">("despesa");
  const [isPending, startTransition] = useTransition();

  const filteredCategories = categories.filter((c) => c.kind === (type === "receita" ? "receita" : "despesa"));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createRecurringTransaction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      form.reset();
      setType("despesa");
      toast.success("Recorrência criada.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {(["despesa", "receita", "transferencia"] as const).map((t) => (
          <label
            key={t}
            className={`text-center cursor-pointer rounded-md border px-2 py-2 text-xs sm:text-sm capitalize transition-colors truncate ${
              type === t
                ? "border-gold text-gold bg-surface-alt"
                : "border-line text-text-muted hover:text-text"
            }`}
          >
            <input
              type="radio"
              name="type"
              value={t}
              checked={type === t}
              onChange={() => setType(t)}
              className="hidden"
            />
            {t === "transferencia" ? (
              <>
                <span className="sm:hidden">Transf.</span>
                <span className="hidden sm:inline">Transferência</span>
              </>
            ) : (
              t
            )}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          name="amount"
          required
          placeholder="Valor"
          inputMode="decimal"
          className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
        />
        <select
          name="account_id"
          required
          className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
        >
          <option value="">{type === "transferencia" ? "Conta de origem" : "Conta"}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {type === "transferencia" ? (
          <select
            name="transfer_account_id"
            required
            className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="">Conta de destino</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            name="category_id"
            className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="">Categoria (opcional)</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <input
          name="description"
          placeholder="Descrição (opcional)"
          className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <select
          name="frequency"
          defaultValue="mensal"
          className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
        >
          <option value="diaria">Diária</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
          <option value="anual">Anual</option>
        </select>
        <input
          name="interval_count"
          type="number"
          min="1"
          defaultValue="1"
          title="A cada quantos períodos (ex: 2 = a cada 2 meses)"
          className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
        />
        <input
          name="start_date"
          type="date"
          required
          defaultValue={todayLocalISO()}
          suppressHydrationWarning
          className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
        />
        <input
          name="end_date"
          type="date"
          title="Data de fim (opcional)"
          className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "A guardar..." : "Criar Recorrência"}
        </button>
      </div>
    </form>
  );
}
