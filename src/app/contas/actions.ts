"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AccountType } from "@/types/database";

export async function createAccount(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "banco") as AccountType;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const openingBalance = Number(String(formData.get("opening_balance") ?? "0").replace(",", "."));
  const currency = String(formData.get("currency") ?? "EUR");

  if (!name) return { error: "O nome da conta é obrigatório." };

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name,
    type,
    institution,
    opening_balance: Number.isFinite(openingBalance) ? openingBalance : 0,
    current_balance: Number.isFinite(openingBalance) ? openingBalance : 0,
    currency,
  });

  if (error) return { error: error.message };

  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return {};
}

export async function archiveAccount(accountId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ is_archived: true }).eq("id", accountId);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return {};
}
