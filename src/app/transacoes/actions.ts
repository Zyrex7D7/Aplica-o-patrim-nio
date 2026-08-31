"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/types/database";

function parseAmount(raw: FormDataEntryValue | null): number {
  return Number(String(raw ?? "0").replace(",", "."));
}

function revalidateTransactionPaths() {
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const type = String(formData.get("type") ?? "despesa") as TransactionType;
  const amount = parseAmount(formData.get("amount"));
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const transferAccountId = String(formData.get("transfer_account_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) throw new Error("O valor tem de ser maior que zero.");
  if (!occurredOn) throw new Error("A data é obrigatória.");
  if (!accountId) throw new Error("Escolhe a conta de origem/destino.");
  if (type === "transferencia" && (!transferAccountId || transferAccountId === accountId)) {
    throw new Error("Escolhe uma conta de destino diferente da conta de origem.");
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type,
    amount,
    occurred_on: occurredOn,
    account_id: accountId,
    transfer_account_id: type === "transferencia" ? transferAccountId : null,
    category_id: type === "transferencia" ? null : categoryId,
    description,
  });

  if (error) throw new Error(error.message);
  revalidateTransactionPaths();
}

/** Edita um movimento existente. Devolve { error } em vez de rebentar, para uso em formulários com useTransition. */
export async function updateTransaction(
  transactionId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const type = String(formData.get("type") ?? "despesa") as TransactionType;
  const amount = parseAmount(formData.get("amount"));
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const transferAccountId = String(formData.get("transfer_account_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) return { error: "O valor tem de ser maior que zero." };
  if (!occurredOn) return { error: "A data é obrigatória." };
  if (!accountId) return { error: "Escolhe a conta de origem/destino." };
  if (type === "transferencia" && (!transferAccountId || transferAccountId === accountId)) {
    return { error: "Escolhe uma conta de destino diferente da conta de origem." };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      type,
      amount,
      occurred_on: occurredOn,
      account_id: accountId,
      transfer_account_id: type === "transferencia" ? transferAccountId : null,
      category_id: type === "transferencia" ? null : categoryId,
      description,
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateTransactionPaths();
  return {};
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
  if (error) throw new Error(error.message);
  revalidateTransactionPaths();
}

export async function createCategory(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "despesa") as "receita" | "despesa";
  const color = String(formData.get("color") ?? "#8B93A1");

  if (!name) throw new Error("O nome da categoria é obrigatório.");

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name,
    kind,
    color,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/transacoes");
}

/** Edita nome, cor e a exclusão dos Relatórios de uma categoria existente. */
export async function updateCategory(
  categoryId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#8B93A1");
  const excludeFromReports = formData.get("exclude_from_reports") === "on";
  const isFee = formData.get("is_fee") === "on";

  if (!name) return { error: "O nome da categoria é obrigatório." };

  const { error } = await supabase
    .from("categories")
    .update({ name, color, exclude_from_reports: excludeFromReports, is_fee: isFee })
    .eq("id", categoryId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/transacoes");
  revalidatePath("/relatorios");
  revalidatePath("/recorrentes");
  return {};
}

/**
 * Apaga uma categoria. As transações que a usavam ficam "Sem categoria"
 * (category_id passa a null via `on delete set null` no schema), nunca são
 * apagadas.
 */
export async function deleteCategory(categoryId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("categories").delete().eq("id", categoryId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/transacoes");
  revalidatePath("/relatorios");
  revalidatePath("/recorrentes");
  return {};
}

/**
 * Cria uma regra de categorização automática: sempre que "keyword" aparecer
 * na descrição de um movimento, a categoria é sugerida automaticamente
 * (ver função SQL `suggest_category`, chamada a partir do formulário).
 */
export async function createCategoryRule(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const keyword = String(formData.get("keyword") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");

  if (!keyword) return { error: "Escreve uma palavra-chave (ex: 'continente', 'netflix')." };
  if (!categoryId) return { error: "Escolhe a categoria a sugerir." };

  const { error } = await supabase.from("category_rules").insert({
    user_id: user.id,
    keyword: keyword.toLowerCase(),
    category_id: categoryId,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "Já existe uma regra com essa palavra-chave." : error.message,
    };
  }
  revalidatePath("/transacoes");
  return {};
}

export async function deleteCategoryRule(ruleId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("category_rules").delete().eq("id", ruleId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/transacoes");
  return {};
}
