import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import type { CsvImport } from "@/types/database";

export default async function ImportacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: imports } = await supabase
    .from("csv_imports")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const list: CsvImport[] = imports ?? [];

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-10 py-10">
      <header className="mb-8">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1.5 text-xs text-text-faint hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          Voltar ao Portefólio
        </Link>
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-faint mb-2">Investimentos</p>
        <h1 className="font-display text-3xl text-text">Histórico de Importações</h1>
        <p className="text-sm text-text-muted mt-2">
          Todos os extratos da DEGIRO que já carregaste, com o número de transações inseridas e
          ignoradas em cada um.
        </p>
      </header>

      <Card>
        {list.length === 0 ? (
          <p className="text-sm text-text-muted py-6 text-center">
            Ainda não importaste nenhum ficheiro.
          </p>
        ) : (
          <ul className="flex flex-col">
            {list.map((imp) => (
              <li
                key={imp.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-line-soft last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text truncate">{imp.file_name}</p>
                  <p className="text-xs text-text-faint mt-0.5">
                    {new Date(imp.created_at).toLocaleString("pt-PT")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs shrink-0">
                  <span className="text-text-muted">Total: {imp.rows_total}</span>
                  <span className="text-gain">Inseridas: {imp.rows_inserted}</span>
                  <span className="text-text-faint">Duplicadas: {imp.rows_duplicated}</span>
                  {imp.rows_failed > 0 && <span className="text-loss">Falhadas: {imp.rows_failed}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
