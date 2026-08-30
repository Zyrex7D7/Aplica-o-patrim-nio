"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Wallet, ArrowLeftRight, PieChart, LineChart } from "lucide-react";
import { cx } from "@/lib/format";

const ITEMS = [
  { href: "/dashboard", label: "Património", icon: LayoutGrid },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/transacoes", label: "Movimentos", icon: ArrowLeftRight },
  { href: "/relatorios", label: "Relatórios", icon: PieChart },
  { href: "/portfolio", label: "Portefólio", icon: LineChart },
];

export function MobileNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] transition-colors",
                active ? "text-gold" : "text-text-faint"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
