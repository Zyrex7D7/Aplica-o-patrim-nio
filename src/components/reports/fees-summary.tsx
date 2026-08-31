"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { FeesSummary, FeeTransactionRow } from "@/types/database";

export function FeesSummaryCard({
  summary,
  transactions,
}: {
  summary: FeesSummary;
  transactions: FeeTransactionRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        <div className="rounded-lg border border-line-soft bg-surface-alt/40 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-1">Comissões Bancárias</p>
          <p className="tabular text-lg text-text">{formatCurrency(summary.banking_fees)}</p>
        </div>
        <div className="rounded-lg border border-line-soft bg-surface-alt/40 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-1">Comissões de Investimento</p>
          <p className="tabular text-lg text-text">{formatCurrency(summary.investment_fees)}</p>
        </div>
        <div className="rounded-lg border border-loss/30 bg-loss-soft/40 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-text-faint mb-1">Total Pago</p>
          <p className="tabular text-lg text-loss">{formatCurrency(summary.total_fees)}</p>
        </div>
      </div>

      {transactions.length > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-text-faint hover:text-gold transition-colors"
          >
            {open ? <ChevronUp size={13} strokeWidth={1.75} /> : <ChevronDown size={13} strokeWidth={1.75} />}
            {open ? "Esconder detalhe" : `Ver detalhe (${transactions.length} linha${transactions.length === 1 ? "" : "s"})`}
          </button>

          {open && (
            <ul className="mt-3 flex flex-col max-h-72 overflow-y-auto">
              {transactions.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-2 border-b border-line-soft last:border-0 text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-text truncate">{t.description}</p>
                    <p className="text-text-faint mt-0.5">
                      {formatDate(t.occurred_on)} · {t.source}
                    </p>
                  </div>
                  <span className="tabular text-loss shrink-0">{formatCurrency(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
