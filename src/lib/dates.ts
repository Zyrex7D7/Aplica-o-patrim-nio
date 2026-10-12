const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Data de hoje (aaaa-mm-dd) no fuso do utilizador — nunca em UTC, para não "adiantar" ou "atrasar" o dia. */
export function todayLocalISO(): string {
  return toISO(new Date());
}

/** Hoje + n dias (n negativo = passado), no fuso do utilizador. */
export function addDaysLocalISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
}
