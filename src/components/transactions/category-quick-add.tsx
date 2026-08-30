"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createCategory } from "@/app/transacoes/actions";

export function CategoryQuickAdd() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  async function action(formData: FormData) {
    startTransition(async () => {
      try {
        await createCategory(formData);
        formRef.current?.reset();
        toast.success("Categoria criada.");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar categoria.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-text-faint hover:text-gold transition-colors"
      >
        <Plus size={13} strokeWidth={1.75} />
        Nova categoria
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input
        name="name"
        required
        placeholder="Nome da categoria"
        className="rounded-md border border-line bg-surface-alt px-2 py-1 text-xs outline-none focus:border-gold"
      />
      <select
        name="kind"
        className="rounded-md border border-line bg-surface-alt px-2 py-1 text-xs outline-none focus:border-gold"
      >
        <option value="despesa">Despesa</option>
        <option value="receita">Receita</option>
      </select>
      <input name="color" type="color" defaultValue="#8B93A1" className="h-6 w-8 rounded border border-line bg-transparent" />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-gold hover:opacity-80 disabled:opacity-50"
      >
        Guardar
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-faint hover:text-text">
        Cancelar
      </button>
    </form>
  );
}
