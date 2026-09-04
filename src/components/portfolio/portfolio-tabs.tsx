"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/lib/format";

export function PortfolioTabs({
  overview,
  projections,
}: {
  overview: ReactNode;
  projections: ReactNode;
}) {
  const [tab, setTab] = useState<"overview" | "projections">("overview");

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-line">
        {(
          [
            { key: "overview" as const, label: "Visão Geral" },
            { key: "projections" as const, label: "Projeções" },
          ]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "px-3 py-2 text-sm -mb-px border-b-2 transition-colors",
              tab === t.key
                ? "border-gold text-gold"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" ? overview : projections}
    </div>
  );
}
