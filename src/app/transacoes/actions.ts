"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/types/database";

function parseAmount(raw: FormDataEntryValue | null): number {
  return Number(String(raw ?? "0").replace(",", "."));
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
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
  if (error) throw new Error(error.message);
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
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
