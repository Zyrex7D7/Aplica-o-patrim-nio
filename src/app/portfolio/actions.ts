"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Remove a importação DEGIRO mais recente do utilizador. Graças ao
 * "on delete cascade" em asset_transactions.import_id, apagar a linha em
 * csv_imports apaga automaticamente todas as transações que essa
 * importação criou.
 *
 * Nota: o "reconciled_balance" da conta (o saldo que a DEGIRO reportou
 * nesta importação) não é revertido automaticamente — só é substituído
 * na próxima importação que reconciliares.
 */
export async function deleteLastImport(): Promise<{ error?: string; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: lastImport, error: findError } = await supabase
    .from("csv_imports")
    .select("id, file_name, rows_inserted")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) return { error: findError.message };
  if (!lastImport) return { error: "Não há nenhuma importação para remover." };

  const { error: deleteError } = await supabase
    .from("csv_imports")
    .delete()
    .eq("id", lastImport.id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/portfolio");
  revalidatePath("/dashboard");

  return {
    message: `Importação "${lastImport.file_name}" removida (${lastImport.rows_inserted} transação(ões)).`,
  };
}
