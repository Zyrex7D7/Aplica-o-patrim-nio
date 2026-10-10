export const PERIODS = [
  { key: "1m", label: "Último Mês" },
  { key: "3m", label: "3 Meses" },
  { key: "6m", label: "6 Meses" },
  { key: "12m", label: "12 Meses" },
  { key: "ytd", label: "Ano Atual" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Recua N meses sem "derrapar" (ex: 31 de março − 1 mês = 28/29 de fevereiro, não 3 de março). */
function monthsBack(now: Date, n: number): Date {
  const target = new Date(now.getFullYear(), now.getMonth() - n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(now.getDate(), lastDay));
}

export function resolvePeriodRange(period: string): { from: string; label: string } {
  const now = new Date();
  let from: Date;

  switch (period) {
    case "3m":
      from = monthsBack(now, 3);
      break;
    case "6m":
      from = monthsBack(now, 6);
      break;
    case "12m":
      from = monthsBack(now, 12);
      break;
    case "ytd":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "1m":
    default:
      from = monthsBack(now, 1);
      break;
  }

  return { from: iso(from), label: period };
}
