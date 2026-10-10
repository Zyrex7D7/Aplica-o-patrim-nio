"use client";

import { useTransition } from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { archiveAccount } from "@/app/contas/actions";

export function ArchiveAccountButton({ accountId }: { accountId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Arquivar esta conta? Deixa de aparecer no dashboard, mas o histórico mantém-se.")) {
      return;
    }
    startTransition(async () => {
      const result = await archiveAccount(accountId);
      if (result.error) toast.error(result.error);
      else toast.success("Conta arquivada.");
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title="Arquivar conta"
      aria-label="Arquivar conta"
      className="text-text-faint hover:text-loss transition-colors disabled:opacity-50"
    >
      <Archive size={15} strokeWidth={1.75} />
    </button>
  );
}
