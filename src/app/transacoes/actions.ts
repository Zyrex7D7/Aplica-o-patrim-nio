"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/types/database";

type Result = { error?: string };

const TYPES: TransactionType[] = ["receita", "despesa", "transferencia"];

function parseAmount(raw: FormDataEntryValue | null): number {
  return Number(String(raw ?? "0").replace(",", "."));
}

function revalidateTransactionPaths() {
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  occurredOn: string;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  description: string | null;
}

function parseTransactionForm(formData: FormData): { value?: ParsedTransaction; error?: string } {
  const rawType = String(formData.get("type") ?? "despesa");
  const type = TYPES.includes(rawType as TransactionType) ? (rawType as TransactionType) : null;
  const amount = parseAmount(formData.get("amount"));
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const transferAccountId = String(formData.get("transfer_account_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!type) return { error: "Tipo de movimento inválido." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "O valor tem de ser maior que zero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return { error: "A data é obrigatória." };
  if (!accountId) return { error: "Escolhe a conta de origem/destino." };
  if (type === "transferencia" && (!transferAccountId || transferAccountId === accountId)) {
    return { error: "Escolhe uma conta de destino diferente da conta de origem." };
  }
  return { value: { type, amount, occurredOn, accountId, transferAccountId, categoryId, description } };
}

export async function createTransaction(formData: FormData): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado." };

  const { value: v, error: validation } = parseTransactionForm(formData);
  if (!v) return { error: validation };

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: v.type,
    amount: v.amount,
    occurred_on: v.occurredOn,
    account_id: v.accountId,
    transfer_account_id: v.type === "transferencia" ? v.transferAccountId : null,
    category_id: v.type === "transferencia" ? null : v.categoryId,
    description: v.description,
  });

  if (error) return { error: error.message };
  revalidateTransactionPaths();
  return {};
}

export async function updateTransaction(transactionId: string, formData: FormData): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado." };

  const { value: v, error: validation } = parseTransactionForm(formData);
  if (!v) return { error: validation };

  const { error } = await supabase
    .from("transactions")
    .update({
      type: v.type,
      amount: v.amount,
      occurred_on: v.occurredOn,
      account_id: v.accountId,
      transfer_account_id: v.type === "transferencia" ? v.transferAccountId : null,
      category_id: v.type === "transferencia" ? null : v.categoryId,
      description: v.description,
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidateTransactionPaths();
  return {};
}

export async function deleteTransaction(transactionId: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("transactions").delete().eq("id", transactionId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidateTransactionPaths();
  return {};
}

export async function createCategory(formData: FormData): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado." };

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "despesa");
  const color = String(formData.get("color") ?? "#8B93A1");

  if (!name) return { error: "O nome da categoria é obrigatório." };
  if (kind !== "receita" && kind !== "despesa") return { error: "Tipo de categoria inválido." };

  const { error } = await supabase.from("categories").insert({ user_id: user.id, name, kind, color });
  if (error) {
    return { error: error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message };
  }
  revalidatePath("/transacoes");
  return {};
}

/** Edita nome, cor, exclusão dos Relatórios e marca de comissão/taxa de uma categoria. */
export async function updateCategory(categoryId: string, formData: FormData): Promise<Result> {
  const { supabase, user } = await getUser();
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

/** Apaga uma categoria; os movimentos que a usavam ficam "Sem categoria" (nunca são apagados). */
export async function deleteCategory(categoryId: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("categories").delete().eq("id", categoryId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/transacoes");
  revalidatePath("/relatorios");
  revalidatePath("/recorrentes");
  return {};
}

export async function createCategoryRule(formData: FormData): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado." };

  const keyword = String(formData.get("keyword") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");

  if (!keyword) return { error: "Escreve uma palavra-chave (ex: 'continente', 'netflix')." };
  if (!categoryId) return { error: "Escolhe a categoria a sugerir." };

  const { error } = await supabase
    .from("category_rules")
    .insert({ user_id: user.id, keyword: keyword.toLowerCase(), category_id: categoryId });

  if (error) {
    return { error: error.code === "23505" ? "Já existe uma regra com essa palavra-chave." : error.message };
  }
  revalidatePath("/transacoes");
  return {};
}

export async function deleteCategoryRule(ruleId: string): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("category_rules").delete().eq("id", ruleId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/transacoes");
  return {};
}
