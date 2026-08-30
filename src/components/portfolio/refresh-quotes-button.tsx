"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function RefreshQuotesButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/quotes");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar cotações.");
        toast.success(`${data.updated} cotação(ões) atualizada(s).`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar cotações.");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors disabled:opacity-50"
    >
      <RefreshCw size={13} strokeWidth={1.75} className={isPending ? "animate-spin" : ""} />
      {isPending ? "A atualizar..." : "Atualizar cotações"}
    </button>
  );
}
