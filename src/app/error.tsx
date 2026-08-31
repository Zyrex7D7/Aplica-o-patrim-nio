"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-loss-soft text-loss">
          <AlertTriangle size={22} strokeWidth={1.75} />
        </div>
        <p className="font-display text-xl text-text mb-2">Algo correu mal</p>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          Não foi possível carregar esta página. Pode ter sido uma falha temporária a ligar à
          base de dados — tenta outra vez.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
        >
          <RotateCw size={14} strokeWidth={1.75} />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
