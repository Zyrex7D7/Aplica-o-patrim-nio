"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cx } from "@/lib/format";
import { NAV_ITEMS } from "@/lib/nav-items";

export function MobileHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha o painel sempre que a rota muda (ex: depois de tocar num link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Impede o scroll do fundo enquanto o painel está aberto.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (pathname === "/login") return null;

  return (
    <>
      <header
        className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b border-line bg-surface/95 backdrop-blur px-4"
        style={{
          height: "calc(52px + env(safe-area-inset-top))",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex items-center gap-2">
          <Image src="/icons/icon-192.png" alt="" width={24} height={24} className="rounded-md" />
          <p className="font-display text-base italic text-text">Meu Capital</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-2 -mr-2 text-text-muted hover:text-text transition-colors"
        >
          <Menu size={22} strokeWidth={1.75} />
        </button>
      </header>

      {/* Fundo escurecido + painel lateral. Fica sempre montado (para a
          transição de saída funcionar) mas sem interação nem visível
          quando fechado. */}
      <div
        className={cx(
          "md:hidden fixed inset-0 z-50 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

        <nav
          className={cx(
            "absolute top-0 left-0 h-full w-72 max-w-[80vw] bg-surface border-r border-line flex flex-col transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-line-soft">
            <div className="flex items-center gap-2.5">
              <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
              <div>
                <p className="font-display text-lg italic leading-tight text-text">Meu Capital</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-text-faint mt-0.5">
                  Património &amp; Finanças
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="p-2 text-text-faint hover:text-text transition-colors"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex flex-col gap-1 px-3 py-4 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-surface-alt text-gold"
                      : "text-text-muted hover:text-text hover:bg-surface-alt/60"
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto px-4 py-4 ledger-rule text-[11px] text-text-faint leading-relaxed">
            Dados armazenados no teu próprio projeto Supabase. Nada é partilhado com terceiros.
          </div>
        </nav>
      </div>
    </>
  );
}
