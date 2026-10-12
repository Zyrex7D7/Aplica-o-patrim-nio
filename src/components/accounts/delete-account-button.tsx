"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccount } from "@/app/contas/actions";

const CONFIRM_WORD = "APAGAR";

/** Apagar conta: pede para escrever APAGAR, porque leva consigo todos os movimentos da conta. */
export function DeleteAccountButton({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setInput("");
  }

  function handleConfirm() {
    if (input.trim().toUpperCase() !== CONFIRM_WORD) {
      toast.error(`Escreve "${CONFIRM_WORD}" para confirmar.`);
      return;
    }
    startTransition(async () => {
      const result = await deleteAccount(accountId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Conta apagada.");
      close();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Apagar conta"
        aria-label={`Apagar a conta ${accountName}`}
        className="text-text-faint hover:text-loss transition-colors"
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <div className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
            <p className="text-base font-bold text-text">Apagar &quot;{accountName}&quot;?</p>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Apaga a conta e <span className="text-text">todos os movimentos e transações de bolsa dela</span>. Não dá para
              desfazer. Se só queres que deixe de aparecer, usa antes o botão de arquivar.
            </p>
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Escreve ${CONFIRM_WORD} para confirmar`}
              className="mt-4 w-full rounded-md border border-loss bg-surface-alt px-3 py-2 text-sm outline-none focus:border-loss"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={close} className="rounded-md px-3 py-2 text-sm text-text-muted hover:text-text">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-md bg-loss px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "A apagar..." : "Apagar conta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
