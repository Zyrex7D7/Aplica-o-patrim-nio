"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cx } from "@/lib/format";
import { PERIODS, type PeriodKey } from "@/lib/reports/period";

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
