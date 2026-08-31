"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTransaction } from "@/app/transacoes/actions";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category } from "@/types/database";

const TODAY = new Date().toISOString().slice(0, 10);

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

  // Sempre que o utilizador sai do campo de descrição, pergunta à base de
  // dados (função `suggest_category`, criada em 004_regras_categorizacao_e_taxas.sql)
  // se alguma regra corresponde ao texto, e pré-seleciona essa categoria.
  // O utilizador pode sempre mudar antes de guardar — isto é só um atalho.
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

  async function action(formData: FormData) {
    startTransition(async () => {
      try {
        await createTransaction(formData);
        formRef.current?.reset();
        setType("despesa");
        setSuggestedCategoryId("");
        toast.success("Movimento registado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registar movimento.");
      }
    });
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(["despesa", "receita", "transferencia"] as const).map((t) => (
          <label
            key={t}
            className={`flex-1 text-center cursor-pointer rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
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
            {t === "transferencia" ? "Transferência" : t}
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
          defaultValue={TODAY}
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

      <div className="flex gap-3">
        <input
          name="description"
          placeholder="Descrição (opcional) — ex: Continente, Netflix..."
          onBlur={(e) => handleDescriptionBlur(e.target.value)}
          className="flex-1 rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
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
