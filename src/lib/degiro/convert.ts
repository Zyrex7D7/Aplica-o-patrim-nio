import type { ParsedDegiroRow } from "@/lib/degiro/parser";

/** Devolve quantos EUR vale 1 unidade de `currency` no fecho de `isoDate` (null se indisponível). */
export type HistFx = (currency: string, isoDate: string) => Promise<number | null>;

export class FxUnavailableError extends Error {}

/**
 * Converte um montante para EUR. O câmbio do CSV pode vir na convenção da DEGIRO (moeda por
 * 1 EUR) ou invertido; o câmbio histórico decide qual das duas é. Sem nenhum câmbio, FALHA
 * (nunca devolve o valor original como se fosse euros).
 */
export async function amountToEur(
  amount: number,
  currency: string,
  csvRate: number | null,
  date: string,
  histFx: HistFx
): Promise<number> {
  if (!currency || currency === "EUR" || amount === 0) return amount;
  const hist = await histFx(currency, date);

  if (csvRate && csvRate > 0) {
    if (hist) {
      if (Math.abs(csvRate / hist - 1) < 0.08) return amount * csvRate;
      if (Math.abs(1 / csvRate / hist - 1) < 0.08) return amount / csvRate;
    } else {
      return amount / csvRate;
    }
  }
  if (hist) return amount * hist;
  throw new FxUnavailableError(`Não foi possível obter o câmbio ${currency}/EUR de ${date}.`);
}

/** Total em EUR de cada linha: valor exato do CSV quando existe, senão conversão. */
export async function convertRowsToEur(
  rows: Pick<ParsedDegiroRow, "totalValue" | "currency" | "exchangeRate" | "date" | "eurAmount">[],
  histFx: HistFx
): Promise<number[]> {
  const out: number[] = [];
  for (const r of rows) {
    out.push(r.eurAmount ?? (await amountToEur(r.totalValue, r.currency, r.exchangeRate, r.date, histFx)));
  }
  return out;
}
