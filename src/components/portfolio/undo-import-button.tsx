"use client";

import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { deleteLastImport } from "@/app/portfolio/actions";

export function UndoImportButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "Remover a última importação DEGIRO? Todas as transações que essa importação criou serão apagadas."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteLastImport();
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Importação removida.");
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 text-xs text-text-faint hover:text-loss transition-colors disabled:opacity-50"
    >
      <Undo2 size={13} strokeWidth={1.75} />
      {isPending ? "A remover..." : "Remover última importação"}
    </button>
  );
}
