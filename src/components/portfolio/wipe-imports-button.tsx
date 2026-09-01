"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAllImports } from "@/app/portfolio/actions";

const CONFIRM_WORD = "APAGAR";

export function WipeImportsButton() {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [input, setInput] = useState("");

  function handleConfirm() {
    if (input.trim().toUpperCase() !== CONFIRM_WORD) {
      toast.error(`Escreve "${CONFIRM_WORD}" para confirmar.`);
      return;
    }
    startTransition(async () => {
      const result = await deleteAllImports();
      if (result.error) toast.error(result.error);
      else toast.success(result.message ?? "Dados apagados.");
      setConfirming(false);
      setInput("");
    });
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-xs text-text-faint hover:text-loss transition-colors"
      >
        <Trash2 size={13} strokeWidth={1.75} />
        Apagar tudo e recomeçar
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 max-w-full">
      <input
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`Escreve ${CONFIRM_WORD}`}
        className="rounded-md border border-loss bg-surface-alt px-2 py-1 text-xs w-32 outline-none focus:border-loss"
      />
      <button
        onClick={handleConfirm}
        disabled={isPending}
        className="text-xs text-loss hover:opacity-80 disabled:opacity-50 shrink-0"
      >
        {isPending ? "A apagar..." : "Confirmar"}
      </button>
      <button
        onClick={() => {
          setConfirming(false);
          setInput("");
        }}
        className="text-xs text-text-faint hover:text-text shrink-0"
      >
        Cancelar
      </button>
    </div>
  );
}
