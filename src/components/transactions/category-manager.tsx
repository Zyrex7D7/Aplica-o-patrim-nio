"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { updateCategory, deleteCategory } from "@/app/transacoes/actions";
import type { Category } from "@/types/database";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const income = categories.filter((c) => c.kind === "receita");
  const expense = categories.filter((c) => c.kind === "despesa");

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-text-faint hover:text-gold transition-colors"
      >
        {open ? "Fechar gestão de categorias" : "Gerir categorias"}
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-2">Despesas</p>
            <ul className="flex flex-col gap-1.5">
              {expense.map((c) => (
                <CategoryRow key={c.id} category={c} />
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-2">Receitas</p>
            <ul className="flex flex-col gap-1.5">
              {income.map((c) => (
                <CategoryRow key={c.id} category={c} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = await updateCategory(category.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Categoria atualizada.");
      setEditing(false);
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Apagar a categoria "${category.name}"? Os movimentos que a usam ficam sem categoria, mas não são apagados.`
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.error) toast.error(result.error);
      else toast.success("Categoria apagada.");
    });
  }

  if (editing) {
    return (
      <li className="rounded-md border border-line-soft bg-surface-alt/50 px-3 py-2">
        <form action={handleSave} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              name="color"
              defaultValue={category.color ?? "#8B93A1"}
              className="h-7 w-9 shrink-0 rounded border border-line bg-transparent"
            />
            <input
              name="name"
              defaultValue={category.name}
              required
              className="flex-1 min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-text-muted">
            <input
              type="checkbox"
              name="exclude_from_reports"
              defaultChecked={category.exclude_from_reports}
              className="accent-gold"
            />
            Excluir dos Relatórios (categorias de ajuste)
          </label>
          <label className="flex items-center gap-2 text-[11px] text-text-muted">
            <input
              type="checkbox"
              name="is_fee"
              defaultChecked={category.is_fee}
              className="accent-gold"
            />
            É uma comissão/taxa (conta para o resumo de Comissões e Taxas)
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-text-faint hover:text-text"
              title="Cancelar"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="text-gold hover:opacity-80 disabled:opacity-50"
              title="Guardar"
            >
              <Check size={14} strokeWidth={1.75} />
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 text-sm py-1">
      <span className="flex items-center gap-2 min-w-0">
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: category.color ?? "#8B93A1" }}
        />
        <span className="text-text truncate">{category.name}</span>
        {category.exclude_from_reports && (
          <span className="text-[10px] uppercase tracking-wide text-text-faint border border-line-soft rounded px-1.5 py-0.5 shrink-0">
            Ajuste
          </span>
        )}
        {category.is_fee && (
          <span className="text-[10px] uppercase tracking-wide text-loss border border-loss/40 rounded px-1.5 py-0.5 shrink-0">
            Taxa
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <button onClick={() => setEditing(true)} className="text-text-faint hover:text-gold" title="Editar">
          <Pencil size={13} strokeWidth={1.75} />
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-text-faint hover:text-loss disabled:opacity-50"
          title="Apagar"
        >
          <Trash2 size={13} strokeWidth={1.75} />
        </button>
      </span>
    </li>
  );
}
