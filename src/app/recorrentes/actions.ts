"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType, RecurrenceFrequency } from "@/types/database";

function parseAmount(raw: FormDataEntryValue | null): number {
  return Number(String(raw ?? "0").replace(",", "."));
}

export async function createRecurringTransaction(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const type = String(formData.get("type") ?? "despesa") as TransactionType;
  const amount = parseAmount(formData.get("amount"));
  const accountId = String(formData.get("account_id") ?? "");
  const transferAccountId = String(formData.get("transfer_account_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const frequency = String(formData.get("frequency") ?? "mensal") as RecurrenceFrequency;
  const intervalCount = Number(formData.get("interval_count") ?? "1");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "") || null;

  if (!Number.isFinite(amount) || amount <= 0) return { error: "O valor tem de ser maior que zero." };
  if (!accountId) return { error: "Escolhe a conta." };
  if (!startDate) return { error: "A data de início é obrigatória." };
  if (type === "transferencia" && (!transferAccountId || transferAccountId === accountId)) {
    return { error: "Escolhe uma conta de destino diferente da conta de origem." };
  }

  const { error } = await supabase.from("recurring_transactions").insert({
    user_id: user.id,
    type,
    amount,
    account_id: accountId,
    transfer_account_id: type === "transferencia" ? transferAccountId : null,
    category_id: type === "transferencia" ? null : categoryId,
    description,
    frequency,
    interval_count: Number.isFinite(intervalCount) && intervalCount > 0 ? intervalCount : 1,
    start_date: startDate,
    end_date: endDate,
    next_occurrence: startDate,
  });

  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return {};
}

export async function toggleRecurringActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_transactions").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return {};
}

export async function deleteRecurringTransaction(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return {};
}
