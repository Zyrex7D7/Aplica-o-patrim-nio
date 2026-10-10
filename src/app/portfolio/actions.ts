"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateAll() {
  revalidatePath("/portfolio");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
}

/**
 * Remove a importação DEGIRO mais recente (e as transações que criou), e repõe o saldo
 * reconciliado da conta a partir da importação anterior — tudo numa só transação (RPC undo_import).
 */
export async function deleteLastImport(): Promise<{ error?: string; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: lastImport, error: findError } = await supabase
    .from("csv_imports")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) return { error: findError.message };
  if (!lastImport) return { error: "Não há nenhuma importação para remover." };

  const { data, error } = await supabase.rpc("undo_import", { p_import_id: lastImport.id });
  if (error) return { error: error.message };

  revalidateAll();
  return { message: `Importação "${data?.file_name}" removida (${data?.rows_inserted ?? 0} transação(ões)).` };
}

/**
 * Apaga TODAS as transações de bolsa e importações DEGIRO do utilizador e limpa o
 * saldo reconciliado das contas afetadas — numa só transação (RPC wipe_imports).
 * Não apaga contas nem o catálogo de ativos.
 */
export async function deleteAllImports(): Promise<{ error?: string; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data, error } = await supabase.rpc("wipe_imports");
  if (error) return { error: error.message };

  revalidateAll();
  if (!data?.accounts) return { message: "Não havia nenhum dado de importação para apagar." };
  return { message: "Todos os dados de importações DEGIRO foram apagados. Podes importar os extratos de novo, do início." };
}
