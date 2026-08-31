"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { Account, Category } from "@/types/database";

export function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const hasFilters = searchParams.get("q") || searchParams.get("account") || searchParams.get("category");

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
      <div className="relative flex-1">
        <Search
          size={14}
          strokeWidth={1.75}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParam("q", text.trim());
          }}
          onBlur={() => updateParam("q", text.trim())}
          placeholder="Pesquisar por descrição..."
          className="w-full rounded-md border border-line bg-surface-alt pl-8 pr-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>
      <select
        defaultValue={searchParams.get("account") ?? ""}
        onChange={(e) => updateParam("account", e.target.value)}
        className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold sm:w-44"
      >
        <option value="">Todas as contas</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("category") ?? ""}
        onChange={(e) => updateParam("category", e.target.value)}
        className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold sm:w-44"
      >
        <option value="">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {hasFilters && (
        <button
          onClick={() => {
            setText("");
            router.push(pathname);
          }}
          title="Limpar filtros"
          className="flex items-center justify-center rounded-md border border-line px-3 py-2 text-text-faint hover:text-text hover:border-line-soft"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
