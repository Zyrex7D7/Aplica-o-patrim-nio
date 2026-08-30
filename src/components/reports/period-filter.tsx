"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cx } from "@/lib/format";

export const PERIODS = [
  { key: "1m", label: "Último Mês" },
  { key: "3m", label: "3 Meses" },
  { key: "6m", label: "6 Meses" },
  { key: "12m", label: "12 Meses" },
  { key: "ytd", label: "Ano Atual" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export function PeriodFilter({ active }: { active: PeriodKey }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-wrap gap-2">
      {PERIODS.map((p) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("period", p.key);
        const isActive = active === p.key;
        return (
          <Link
            key={p.key}
            href={`${pathname}?${params.toString()}`}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              isActive
                ? "border-gold text-gold bg-surface-alt"
                : "border-line text-text-muted hover:text-text"
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}

export function resolvePeriodRange(period: string): { from: string; label: string } {
  const now = new Date();
  const from = new Date(now);

  switch (period) {
    case "3m":
      from.setMonth(now.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(now.getMonth() - 6);
      break;
    case "12m":
      from.setMonth(now.getMonth() - 12);
      break;
    case "ytd":
      from.setMonth(0, 1);
      break;
    case "1m":
    default:
      from.setMonth(now.getMonth() - 1);
      break;
  }

  return { from: from.toISOString().slice(0, 10), label: period };
}
