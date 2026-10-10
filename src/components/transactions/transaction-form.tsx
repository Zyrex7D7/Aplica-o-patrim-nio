"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTransaction } from "@/app/transacoes/actions";
import { createClient } from "@/lib/supabase/client";
import { todayLocalISO } from "@/lib/dates";
import type { Account, Category } from "@/types/database";

export function TransactionForm({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<"receita" | "despesa" | "transferencia">("despesa");
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const filteredCategories = categories.filter((c) => c.kind === (type === "receita" ? "receita" : "despesa"));

  // Ao sair do campo de descrição, pergunta à base de dados se alguma regra do utilizador
  // corresponde ao texto e pré-seleciona essa categoria (continua editável).
  async function handleDescriptionBlur(description: string) {
    const text = description.trim();
    if (!text) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("suggest_category", { p_description: text });
    if (!error && data) {
      const suggested = filteredCategories.find((c) => c.id === data);
      if (suggested) setSuggestedCategoryId(data as string);
    }
  }

  // onSubmit (e não <form action>) para o React não limpar os campos antes de sabermos
  // se a gravação correu bem: se falhar, o que escreveste fica lá.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createTransaction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      form.reset();
      setType("despesa");
      setSuggestedCategoryId("");
      toast.success("Movimento registado.");
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              onChange={() => {
                setType(t);
                setSuggestedCategoryId("");
              }}
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
        <input
          name="occurred_on"
          type="date"
          required
          defaultValue={todayLocalISO()}
          suppressHydrationWarning
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
            value={suggestedCategoryId}
            onChange={(e) => setSuggestedCategoryId(e.target.value)}
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
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          name="description"
          placeholder="Descrição (opcional) — ex: Continente, Netflix..."
          onBlur={(e) => handleDescriptionBlur(e.target.value)}
          className="flex-1 min-w-0 rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          {isPending ? "A guardar..." : "Registar"}
        </button>
      </div>
      {suggestedCategoryId && (
        <p className="text-[11px] text-text-faint -mt-1">
          Categoria sugerida automaticamente com base numa regra tua — muda-a se não for a certa.
        </p>
      )}
    </form>
  );
}
