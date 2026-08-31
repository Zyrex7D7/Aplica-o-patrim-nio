"use client";

import { Download } from "lucide-react";
import type { Category, Transaction } from "@/types/database";

function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ExportCsvButton({
  transactions,
  categories,
  periodLabel,
}: {
  transactions: Transaction[];
  categories: Category[];
  periodLabel: string;
}) {
  function handleExport() {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const header = ["Data", "Tipo", "Valor", "Categoria", "Descrição"];
    const lines = transactions.map((t) => {
      const cat = t.category_id ? categoryById.get(t.category_id) : null;
      return [
        t.occurred_on,
        t.type,
        String(t.amount).replace(".", ","),
        cat?.name ?? "",
        t.description ?? "",
      ]
        .map(csvEscape)
        .join(";");
    });

    // BOM (\uFEFF) para o Excel em PT-PT abrir os acentos corretamente.
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimentos_${periodLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={transactions.length === 0}
      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors disabled:opacity-40 disabled:hover:text-text-muted"
    >
      <Download size={13} strokeWidth={1.75} />
      Exportar CSV
    </button>
  );
}
