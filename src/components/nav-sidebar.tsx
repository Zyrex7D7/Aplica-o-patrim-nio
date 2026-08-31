"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";
import { NAV_ITEMS } from "@/lib/nav-items";

export function NavSidebar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface/40 px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={28}
          height={28}
          className="rounded-md shrink-0"
        />
        <div>
          <p className="font-display text-lg italic leading-tight tracking-tight text-text">
            Meu Capital
          </p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-faint mt-0.5">
            Património &amp; Finanças
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
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
