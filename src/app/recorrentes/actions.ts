"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType, RecurrenceFrequency } from "@/types/database";

type Result = { error?: string };

const TYPES: TransactionType[] = ["receita", "despesa", "transferencia"];
const FREQUENCIES: RecurrenceFrequency[] = ["diaria", "semanal", "mensal", "anual"];

function parseAmount(raw: FormDataEntryValue | null): number {
  return Number(String(raw ?? "0").replace(",", "."));
}

export async function createRecurringTransaction(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const rawType = String(formData.get("type") ?? "despesa");
  const rawFrequency = String(formData.get("frequency") ?? "mensal");
  const amount = parseAmount(formData.get("amount"));
  const accountId = String(formData.get("account_id") ?? "");
  const transferAccountId = String(formData.get("transfer_account_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const intervalCount = Math.floor(Number(formData.get("interval_count") ?? "1"));
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "") || null;

  if (!TYPES.includes(rawType as TransactionType)) return { error: "Tipo inválido." };
  if (!FREQUENCIES.includes(rawFrequency as RecurrenceFrequency)) return { error: "Frequência inválida." };
  const type = rawType as TransactionType;
  const frequency = rawFrequency as RecurrenceFrequency;

  if (!Number.isFinite(amount) || amount <= 0) return { error: "O valor tem de ser maior que zero." };
  if (!accountId) return { error: "Escolhe a conta." };
  if (!Number.isFinite(intervalCount) || intervalCount < 1) return { error: "O intervalo tem de ser pelo menos 1." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { error: "A data de início é obrigatória." };
  if (endDate && endDate < startDate) return { error: "A data de fim não pode ser anterior à de início." };
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
    interval_count: intervalCount,
    start_date: startDate,
    end_date: endDate,
    next_occurrence: startDate,
  });

  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return {};
}

export async function toggleRecurringActive(id: string, isActive: boolean): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("recurring_transactions")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return {};
}

export async function deleteRecurringTransaction(id: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return {};
}
