"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createCategoryRule, deleteCategoryRule } from "@/app/transacoes/actions";
import type { Category, CategoryRule } from "@/types/database";

export function CategoryRulesManager({
  rules,
  categories,
}: {
  rules: CategoryRule[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createCategoryRule(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      formRef.current?.reset();
      toast.success("Regra criada.");
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      const result = await deleteCategoryRule(ruleId);
      if (result.error) toast.error(result.error);
      else toast.success("Regra removida.");
    });
  }

  return (
    <div className="mt-4 pt-4 border-t border-line-soft">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-text-faint hover:text-gold transition-colors"
      >
        <Sparkles size={13} strokeWidth={1.75} />
        {open ? "Fechar categorização automática" : "Categorização automática"}
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-xs text-text-faint mb-3 leading-relaxed">
            Sempre que a palavra-chave aparecer na descrição de um novo movimento, a categoria é
            sugerida automaticamente no formulário (podes sempre mudar antes de guardar).
          </p>

          <form ref={formRef} action={handleCreate} className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              name="keyword"
              required
              placeholder="Palavra-chave (ex: continente, netflix, cepsa)"
              className="flex-1 rounded-md border border-line bg-surface-alt px-3 py-2 text-xs outline-none focus:border-gold"
            />
            <select
              name="category_id"
              required
              className="rounded-md border border-line bg-surface-alt px-3 py-2 text-xs outline-none focus:border-gold sm:w-56"
            >
              <option value="">Categoria a sugerir</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-gold px-3 py-2 text-xs font-medium text-ink hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              Adicionar
            </button>
          </form>

          {rules.length === 0 ? (
            <p className="text-xs text-text-faint">Ainda não tens regras criadas.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rules.map((r) => {
                const cat = categoryById.get(r.category_id);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-xs py-1">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-text truncate">&quot;{r.keyword}&quot;</span>
                      <span className="text-text-faint">→</span>
                      {cat && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color ?? "#8B93A1" }}
                        />
                      )}
                      <span className="text-text-muted truncate">{cat?.name ?? "—"}</span>
                    </span>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={isPending}
                      className="text-text-faint hover:text-loss disabled:opacity-50 shrink-0"
                      title="Remover regra"
                    >
                      <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
