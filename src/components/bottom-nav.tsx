"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Wallet, ArrowLeftRight, PieChart, LineChart } from "lucide-react";
import { cx } from "@/lib/format";

const ITEMS = [
  { href: "/dashboard", label: "Início", icon: LayoutGrid },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/transacoes", label: "Movimentos", icon: ArrowLeftRight },
  { href: "/relatorios", label: "Relatórios", icon: PieChart },
  { href: "/portfolio", label: "Portefólio", icon: LineChart },
];

/**
 * Navegação inferior fixa, só visível em ecrãs pequenos (md:hidden) — no
 * desktop usa-se a NavSidebar em vez disto. Isto é o que faz a app
 * parecer uma app nativa no telemóvel em vez de um site.
 *
 * `env(safe-area-inset-bottom)` evita que os botões fiquem escondidos
 * atrás da barra de gestos do iPhone quando a app corre em modo standalone
 * (adicionada ao ecrã principal).
 */
export function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm"
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
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
