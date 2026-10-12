"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { QuickEntry } from "@/components/transactions/quick-entry";
import type { Account, Category } from "@/types/database";

interface Data {
  accounts: Account[];
  categories: Category[];
  usage: Record<string, number>;
}

/** Botão "+" disponível em todas as páginas: abre o registo rápido sem sair de onde estás. */
export function QuickAddFab() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const supabase = createClient();
      const [acc, cat, recent] = await Promise.all([
        supabase.from("accounts").select("*").eq("is_archived", false).order("name"),
        supabase.from("categories").select("*").order("name"),
        supabase.from("transactions").select("category_id").order("created_at", { ascending: false }).limit(300),
      ]);
      if (acc.error || cat.error) throw new Error((acc.error ?? cat.error)!.message);
      const usage: Record<string, number> = {};
      for (const t of (recent.data ?? []) as { category_id: string | null }[]) {
        if (t.category_id) usage[t.category_id] = (usage[t.category_id] ?? 0) + 1;
      }
      setData({ accounts: (acc.data ?? []) as Account[], categories: (cat.data ?? []) as Category[], usage });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as contas.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/login") return null;

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          if (!data) void loadData();
        }}
        aria-label="Novo movimento"
        className="fixed right-4 md:right-6 z-40 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-ink shadow-lg shadow-black/40 hover:opacity-90"
      >
        <Plus size={28} strokeWidth={2.25} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Novo movimento"
            className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 md:inset-auto md:left-1/2 md:top-1/2 md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-bold text-text">Novo movimento</p>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-text-faint hover:text-text">
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            {error && (
              <p className="text-sm text-loss">
                {error}{" "}
                <button onClick={() => void loadData()} className="underline">
                  Tentar novamente
                </button>
              </p>
            )}
            {!error && !data && <p className="text-sm text-text-muted py-6 text-center">A carregar…</p>}
            {data && data.accounts.length === 0 && (
              <p className="text-sm text-text-muted">
                Precisas de pelo menos uma conta.{" "}
                <a href="/contas" className="text-gold underline underline-offset-2">
                  Cria uma conta
                </a>
                .
              </p>
            )}
            {data && data.accounts.length > 0 && (
              <QuickEntry
                accounts={data.accounts}
                categories={data.categories}
                usage={data.usage}
                autoFocus
                onSaved={() => {
                  setOpen(false);
                  router.refresh();
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
