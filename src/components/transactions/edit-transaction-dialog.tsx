"use client";

import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateTransaction } from "@/app/transacoes/actions";
import type { Account, Category, Transaction, TransactionType } from "@/types/database";

export function EditTransactionDialog({
  transaction,
  accounts,
  categories,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [isPending, startTransition] = useTransition();

  const filteredCategories = categories.filter((c) => c.kind === (type === "receita" ? "receita" : "despesa"));

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateTransaction(transaction.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Movimento atualizado.");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Editar movimento"
        className="text-text-faint hover:text-gold transition-colors shrink-0"
      >
        <Pencil size={14} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg rounded-lg border border-line bg-surface p-5 max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-text">Editar Movimento</p>
              <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text">
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <form action={handleSubmit} className="flex flex-col gap-3">
              {/*
                grid-cols-3 (em vez de flex + flex-1) garante que as 3
                opções ocupam sempre exatamente um terço da largura cada,
                sem nunca esticar a linha para fora do cartão.
              */}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  name="amount"
                  required
                  defaultValue={transaction.amount}
                  placeholder="Valor"
                  inputMode="decimal"
                  className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
                />
                <input
                  name="occurred_on"
                  type="date"
                  required
                  defaultValue={transaction.occurred_on}
                  className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
                />
                <select
                  name="account_id"
                  required
                  defaultValue={transaction.account_id}
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
                    defaultValue={transaction.transfer_account_id ?? ""}
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
                    defaultValue={transaction.category_id ?? ""}
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

              <input
                name="description"
                defaultValue={transaction.description ?? ""}
                placeholder="Descrição (opcional)"
                className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
              />

              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-text-muted hover:text-text"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
