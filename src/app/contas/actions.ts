"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AccountType } from "@/types/database";

export async function createAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "banco") as AccountType;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const openingBalance = Number(String(formData.get("opening_balance") ?? "0").replace(",", "."));
  const currency = String(formData.get("currency") ?? "EUR");

  if (!name) throw new Error("O nome da conta é obrigatório.");

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name,
    type,
    institution,
    opening_balance: Number.isFinite(openingBalance) ? openingBalance : 0,
    current_balance: Number.isFinite(openingBalance) ? openingBalance : 0,
    currency,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/contas");
  revalidatePath("/dashboard");
}

export async function archiveAccount(accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ is_archived: true }).eq("id", accountId);
  if (error) throw new Error(error.message);
  revalidatePath("/contas");
  revalidatePath("/dashboard");
}
