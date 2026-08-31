"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertBudget(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const categoryId = String(formData.get("category_id") ?? "");
  const monthlyLimit = Number(String(formData.get("monthly_limit") ?? "0").replace(",", "."));

  if (!categoryId) return { error: "Escolhe uma categoria." };
  if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) return { error: "O limite tem de ser maior que zero." };

  const { error } = await supabase
    .from("budgets")
    .upsert(
      { user_id: user.id, category_id: categoryId, monthly_limit: monthlyLimit },
      { onConflict: "user_id,category_id" }
    );

  if (error) return { error: error.message };
  revalidatePath("/relatorios");
  return {};
}

export async function deleteBudget(categoryId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("budgets").delete().eq("category_id", categoryId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/relatorios");
  return {};
}
