"use client";

import { useRef, useTransition } from "react";
import { createAccount } from "@/app/contas/actions";
import { toast } from "sonner";

export function AccountForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  async function action(formData: FormData) {
    startTransition(async () => {
      const result = await createAccount(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      formRef.current?.reset();
      toast.success("Conta criada.");
    });
  }

  return (
    <form ref={formRef} action={action} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <input
        name="name"
        required
        placeholder="Nome (ex: Santander)"
        className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
      />
      <select
        name="type"
        className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
      >
        <option value="banco">Banco</option>
        <option value="poupanca">Poupança</option>
        <option value="corretora">Corretora</option>
        <option value="numerario">Numerário</option>
      </select>
      <input
        name="institution"
        placeholder="Instituição (opcional)"
        className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold"
      />
      <input
        name="opening_balance"
        placeholder="Saldo inicial"
        inputMode="decimal"
        defaultValue="0"
        className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold tabular"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gold px-3 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "A criar..." : "Adicionar Conta"}
      </button>
      <input type="hidden" name="currency" value="EUR" />
    </form>
  );
}
