"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getQuote, searchSymbol } from "@/lib/market/quotes";

export async function addToWatchlist(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const text = String(formData.get("query") ?? "").trim();
  if (!text) return { error: "Escreve um nome, ticker ou ISIN." };

  const found = await searchSymbol(text);
  if (!found) return { error: `Não encontrei nada para "${text}".` };

  const quote = await getQuote(found.symbol);
  const { error } = await supabase.from("watchlist").insert({
    user_id: user.id,
    symbol: found.symbol,
    name: found.name,
    currency: quote?.currency ?? "EUR",
    added_price: quote?.price ?? null,
  });

  if (error) return { error: error.code === "23505" ? "Já estás a seguir este ativo." : error.message };
  revalidatePath("/radar");
  return {};
}

export async function removeFromWatchlist(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  const { error } = await supabase.from("watchlist").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/radar");
  return {};
}
