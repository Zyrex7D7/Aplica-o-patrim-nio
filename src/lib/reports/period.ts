export const PERIODS = [
  { key: "1m", label: "Último Mês" },
  { key: "3m", label: "3 Meses" },
  { key: "6m", label: "6 Meses" },
  { key: "12m", label: "12 Meses" },
  { key: "ytd", label: "Ano Atual" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export function resolvePeriodRange(period: string): { from: string; label: string } {
  const now = new Date();
  const from = new Date(now);

  switch (period) {
    case "3m":
      from.setMonth(now.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(now.getMonth() - 6);
      break;
    case "12m":
      from.setMonth(now.getMonth() - 12);
      break;
    case "ytd":
      from.setMonth(0, 1);
      break;
    case "1m":
    default:
      from.setMonth(now.getMonth() - 1);
      break;
  }

  return { from: from.toISOString().slice(0, 10), label: period };
}
