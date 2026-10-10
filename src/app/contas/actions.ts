"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AccountType } from "@/types/database";

type Result = { error?: string };

const ACCOUNT_TYPES: AccountType[] = ["banco", "corretora", "numerario", "poupanca"];

function parseType(raw: FormDataEntryValue | null): AccountType | null {
  const v = String(raw ?? "banco");
  return ACCOUNT_TYPES.includes(v as AccountType) ? (v as AccountType) : null;
}

export async function createAccount(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const name = String(formData.get("name") ?? "").trim();
  const type = parseType(formData.get("type"));
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const openingBalance = Number(String(formData.get("opening_balance") ?? "0").replace(",", "."));
  const currency = String(formData.get("currency") ?? "EUR");

  if (!name) return { error: "O nome da conta é obrigatório." };
  if (!type) return { error: "Tipo de conta inválido." };
  if (!Number.isFinite(openingBalance)) return { error: "O saldo inicial não é um número válido." };

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name,
    type,
    institution,
    opening_balance: openingBalance,
    current_balance: openingBalance,
    currency,
  });

  if (error) return { error: error.message };
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return {};
}

/**
 * Edita nome, tipo e instituição. O saldo não se edita aqui: é sempre derivado dos
 * movimentos; para o corrigir, regista um movimento da categoria "Ajuste de Saldo".
 */
export async function updateAccount(accountId: string, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const name = String(formData.get("name") ?? "").trim();
  const type = parseType(formData.get("type"));
  const institution = String(formData.get("institution") ?? "").trim() || null;

  if (!name) return { error: "O nome da conta é obrigatório." };
  if (!type) return { error: "Tipo de conta inválido." };

  const { error } = await supabase
    .from("accounts")
    .update({ name, type, institution })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  revalidatePath("/transacoes");
  revalidatePath("/portfolio");
  return {};
}

export async function archiveAccount(accountId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: true })
    .eq("id", accountId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return {};
}
