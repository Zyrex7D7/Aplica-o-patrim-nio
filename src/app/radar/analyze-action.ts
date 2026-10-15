"use server";

import { redirect } from "next/navigation";
import { searchSymbol } from "@/lib/market/quotes";

/** Procura o ativo (nome, ticker ou ISIN) e abre a análise, sem ser preciso seguir primeiro. */
export async function analyzeSymbol(formData: FormData): Promise<void> {
  const text = String(formData.get("query") ?? "").trim();
  if (!text) redirect("/radar");
  const found = await searchSymbol(text);
  if (!found) redirect(`/radar?analise=${encodeURIComponent(text)}`);
  redirect(`/radar/${encodeURIComponent(found.symbol)}`);
}
