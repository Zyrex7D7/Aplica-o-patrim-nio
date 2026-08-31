"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Wallet, ArrowLeftRight, Repeat, PieChart, LineChart } from "lucide-react";
import { cx } from "@/lib/format";

const ITEMS = [
  { href: "/dashboard", label: "Património", icon: LayoutGrid },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/transacoes", label: "Movimentos", icon: ArrowLeftRight },
  { href: "/recorrentes", label: "Recorrências", icon: Repeat },
  { href: "/relatorios", label: "Relatórios", icon: PieChart },
  { href: "/portfolio", label: "Portefólio", icon: LineChart },
];

export function NavSidebar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface/40 px-4 py-6">
      <div className="px-2 mb-8">
        <p className="font-display text-xl italic tracking-tight text-text">Livro</p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mt-0.5">
          Património &amp; Finanças
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-alt text-gold"
                  : "text-text-muted hover:text-text hover:bg-surface-alt/60"
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 ledger-rule text-[11px] text-text-faint leading-relaxed">
        Dados armazenados no teu próprio projeto Supabase. Nada é partilhado com terceiros.
      </div>
    </aside>
  );
}
