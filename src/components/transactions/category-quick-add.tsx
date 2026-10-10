"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createCategory } from "@/app/transacoes/actions";

export function CategoryQuickAdd() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createCategory(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      form.reset();
      toast.success("Categoria criada.");
      setOpen(false);
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
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
      <input
        name="color"
        type="color"
        aria-label="Cor da categoria"
        defaultValue="#8B93A1"
        className="h-6 w-8 rounded border border-line bg-transparent"
      />
      <button type="submit" disabled={isPending} className="text-xs text-gold hover:opacity-80 disabled:opacity-50">
        Guardar
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-faint hover:text-text">
        Cancelar
      </button>
    </form>
  );
}
