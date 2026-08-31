"use client";

import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateAccount } from "@/app/contas/actions";
import type { Account } from "@/types/database";

const TYPE_LABEL: Record<Account["type"], string> = {
  banco: "Banco",
  poupanca: "Poupança",
  corretora: "Corretora",
  numerario: "Numerário",
};

export function EditAccountDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateAccount(account.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta atualizada.");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Editar conta"
        className="text-text-faint hover:text-gold transition-colors"
      >
        <Pencil size={14} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-lg border border-line bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-text">Editar Conta</p>
              <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text">
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <form action={handleSubmit} className="flex flex-col gap-3">
              <input
                name="name"
                required
                defaultValue={account.name}
                placeholder="Nome"
                className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <select
                name="type"
                defaultValue={account.type}
                className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
              >
                {(Object.keys(TYPE_LABEL) as Account["type"][]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <input
                name="institution"
                defaultValue={account.institution ?? ""}
                placeholder="Instituição (opcional)"
                className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <p className="text-[11px] text-text-faint leading-relaxed">
                O saldo não se edita aqui — é sempre calculado a partir dos movimentos. Para
                corrigir um saldo, regista um movimento com a categoria &quot;Ajuste de Saldo&quot;.
              </p>
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
