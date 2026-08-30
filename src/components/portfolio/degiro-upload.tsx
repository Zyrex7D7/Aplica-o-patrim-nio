"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Account } from "@/types/database";

interface ImportResult {
  alreadyImported?: boolean;
  message?: string;
  format?: string;
  rowsTotal?: number;
  rowsInserted?: number;
  rowsDuplicated?: number;
  rowsSkipped?: number;
  warnings?: string[];
  error?: string;
  reconciledBalance?: { balance: number; at: string } | null;
}

export function DegiroUpload({ brokerAccounts }: { brokerAccounts: Account[] }) {
  const [accountId, setAccountId] = useState(brokerAccounts[0]?.id ?? "");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFile(file: File) {
    if (!accountId) {
      toast.error("Escolhe primeiro a corretora onde este extrato foi gerado.");
      return;
    }
    startTransition(async () => {
      try {
        const csvText = await file.text();
        const res = await fetch("/api/degiro/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvText, fileName: file.name, accountId }),
        });
        const data: ImportResult = await res.json();
        setResult(data);

        if (!res.ok) {
          toast.error(data.error ?? "Erro ao importar o ficheiro.");
          return;
        }
        if (data.alreadyImported) {
          toast.info(data.message ?? "Ficheiro já importado anteriormente.");
          return;
        }
        toast.success(`${data.rowsInserted} transação(ões) importada(s).`);
        router.refresh();
      } catch {
        toast.error("Não foi possível ler o ficheiro.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  if (brokerAccounts.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Precisas de uma conta do tipo &quot;Corretora&quot; antes de importares. Vai a{" "}
        <a href="/contas" className="text-gold underline underline-offset-2">
          Contas
        </a>{" "}
        e cria uma (ex: DEGIRO).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="rounded-md border border-line bg-surface-alt px-3 py-2 text-sm outline-none focus:border-gold sm:w-64"
        >
          {brokerAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <label
          className={`flex-1 flex items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm cursor-pointer transition-colors ${
            isPending
              ? "border-line text-text-faint opacity-60"
              : "border-line-soft text-text-muted hover:border-gold hover:text-gold"
          }`}
        >
          <UploadCloud size={16} strokeWidth={1.75} />
          {isPending ? "A processar..." : "Escolher CSV da DEGIRO (Transacções ou Estado de Conta)"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={isPending}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>

      {result && (
        <div className="rounded-md border border-line-soft bg-surface-alt/60 px-4 py-3 text-xs text-text-muted">
          {result.error ? (
            <p className="text-loss">{result.error}</p>
          ) : result.alreadyImported ? (
            <p>{result.message}</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Formato detetado: <span className="text-text">{result.format}</span>
              </span>
              <span>
                Linhas no ficheiro: <span className="text-text">{result.rowsTotal}</span>
              </span>
              <span className="text-gain">Inseridas: {result.rowsInserted}</span>
              <span>Duplicadas (ignoradas): {result.rowsDuplicated}</span>
              {(result.rowsSkipped ?? 0) > 0 && <span className="text-loss">Ignoradas: {result.rowsSkipped}</span>}
            </div>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-text-faint">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {result.reconciledBalance && (
            <p className="mt-2 text-gain">
              Saldo da conta atualizado para {result.reconciledBalance.balance.toLocaleString("pt-PT", {
                style: "currency",
                currency: "EUR",
              })}{" "}
              (conforme reportado pela DEGIRO em{" "}
              {new Date(result.reconciledBalance.at).toLocaleDateString("pt-PT")}).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
