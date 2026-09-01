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

/**
 * Apaga TODAS as transações de bolsa e importações DEGIRO do utilizador,
 * e limpa o ponto de reconciliação das contas afetadas (para os saldos
 * voltarem a ser calculados a partir do saldo inicial). Usa-se quando algo
 * ficou inconsistente e é mais simples recomeçar do zero do que ir a
 * caçar o problema linha a linha.
 *
 * Não apaga as contas em si, nem o catálogo de ativos (`assets`) — só os
 * dados específicos deste utilizador ligados às importações.
 */
export async function deleteAllImports(): Promise<{ error?: string; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: affectedRows, error: findError } = await supabase
    .from("asset_transactions")
    .select("account_id")
    .eq("user_id", user.id);

  if (findError) return { error: findError.message };

  const accountIds = Array.from(new Set((affectedRows ?? []).map((r) => r.account_id)));

  if (accountIds.length === 0) {
    return { message: "Não havia nenhum dado de importação para apagar." };
  }

  const { error: txError } = await supabase
    .from("asset_transactions")
    .delete()
    .eq("user_id", user.id);
  if (txError) return { error: txError.message };

  const { error: importsError } = await supabase
    .from("csv_imports")
    .delete()
    .eq("user_id", user.id);
  if (importsError) return { error: importsError.message };

  // Limpa o ponto de reconciliação -> o saldo volta a ser calculado a
  // partir de opening_balance + transações de orçamento, como se nunca
  // tivesse havido nenhuma importação DEGIRO nesta conta.
  const { error: resetError } = await supabase
    .from("accounts")
    .update({ reconciled_balance: null, reconciled_at: null })
    .in("id", accountIds);
  if (resetError) return { error: resetError.message };

  for (const accountId of accountIds) {
    await supabase.rpc("refresh_account_balance", { p_account_id: accountId });
  }

  revalidatePath("/portfolio");
  revalidatePath("/dashboard");
  revalidatePath("/contas");

  return {
    message:
      "Todos os dados de importações DEGIRO foram apagados. Podes importar os extratos de novo, do início.",
  };
}
