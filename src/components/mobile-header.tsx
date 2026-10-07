"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { cx, formatPercent } from "@/lib/format";

export interface HeaderSummary {
  hasQuotes: boolean;
  dayChangeEur: number;
  dayChangePct: number;
  lastQuoteAt: string | null;
  marketOpen: boolean;
}

const eur0 = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Topo fixo (só telemóvel): logo à esquerda; variação do dia e estado do mercado à direita. */
export function MobileHeader({ summary }: { summary: HeaderSummary | null }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const up = (summary?.dayChangeEur ?? 0) >= 0;
  const date = summary?.lastQuoteAt
    ? new Date(summary.lastQuoteAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <header
      className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-surface/95 backdrop-blur px-4"
      style={{ height: "calc(60px + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="rounded-lg" />
        <p className="font-bold text-base text-text truncate">Meu Capital</p>
      </div>

      {summary && (
        <div className="text-right leading-tight shrink-0">
          {summary.hasQuotes && (
            <p className={cx("tabular text-sm font-semibold", up ? "text-gain" : "text-loss")}>
              {up ? "+" : "−"}
              {eur0.format(Math.abs(summary.dayChangeEur))}{" "}
              <span className="font-medium">{formatPercent(summary.dayChangePct)}</span>
              {date && (
                <span className="text-text-muted font-normal ml-1" suppressHydrationWarning>
                  {date}
                </span>
              )}
            </p>
          )}
          <p className="text-xs text-text-muted flex items-center justify-end gap-1.5 mt-0.5">
            <span className={cx("inline-block h-1.5 w-1.5 rounded-full", summary.marketOpen ? "bg-gain" : "bg-text-faint")} />
            {summary.marketOpen ? "Mercado aberto" : "Mercado encerrado"}
          </p>
        </div>
      )}
    </header>
  );
}
