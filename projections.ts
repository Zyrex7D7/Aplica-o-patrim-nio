import type { NetWorthSnapshot } from "@/types/database";

export interface ProjectionPoint {
  year: number;
  conservador: number;
  moderado: number;
  otimista: number;
}

/** Taxa por omissão quando ainda não há histórico suficiente para estimar (média histórica de referência do mercado de ações). */
export const DEFAULT_MODERATE_RATE = 7;

/**
 * Estima a taxa de crescimento anualizada do portefólio a partir do
 * histórico de snapshots de património (net_worth_snapshots.portfolio_value),
 * que já é capturado todos os dias pela função `capture_net_worth_snapshot`.
 *
 * Atenção: isto NÃO é uma taxa de retorno "pura" de mercado — o valor do
 * portefólio também sobe quando compras novas ações, por isso esta taxa
 * mistura performance de mercado com novo capital investido. É só uma
 * estimativa aproximada para sugerir um ponto de partida, nunca uma
 * previsão garantida.
 */
export function estimateAnnualGrowthRate(
  snapshots: Pick<NetWorthSnapshot, "snapshot_date" | "portfolio_value">[]
): number | null {
  const valid = snapshots
    .filter((s) => Number(s.portfolio_value) > 0)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  if (valid.length < 2) return null;

  const first = valid[0];
  const last = valid[valid.length - 1];
  const days =
    (new Date(last.snapshot_date).getTime() - new Date(first.snapshot_date).getTime()) / 86_400_000;

  // Precisamos de pelo menos ~2 semanas de histórico para a taxa não ficar
  // completamente instável (1 dia de diferença extrapolado para um ano dá
  // valores absurdos).
  if (days < 14) return null;

  const totalReturn =
    (Number(last.portfolio_value) - Number(first.portfolio_value)) / Number(first.portfolio_value);
  const years = days / 365;
  const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;

  // Limita a um intervalo plausível — evita mostrar projeções absurdas a
  // partir de janelas de dados muito curtas ou muito voláteis.
  return Math.max(-30, Math.min(30, cagr * 100));
}

/** Constrói os 3 cenários (-3pp / base / +3pp) a partir de uma taxa "moderada". */
export function buildScenarios(
  baseRatePct: number
): { conservador: number; moderado: number; otimista: number } {
  const moderado = Math.max(0, baseRatePct);
  return {
    conservador: Math.max(0, moderado - 3),
    moderado,
    otimista: moderado + 3,
  };
}

/**
 * Projeta a evolução do valor do portefólio ano a ano, assumindo uma taxa
 * de retorno anual constante e um investimento mensal constante — ambas
 * simplificações. Na vida real nem o mercado nem os teus depósitos são
 * constantes; isto serve para teres uma ordem de grandeza, não uma
 * garantia de resultado.
 */
function projectValue(
  initialValue: number,
  monthlyContribution: number,
  annualRatePct: number,
  years: number
): number[] {
  const monthlyRate = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  const values: number[] = [initialValue];
  let value = initialValue;
  for (let month = 1; month <= years * 12; month++) {
    value = value * (1 + monthlyRate) + monthlyContribution;
    if (month % 12 === 0) values.push(value);
  }
  return values;
}

export function buildProjection(
  initialValue: number,
  monthlyContribution: number,
  rates: { conservador: number; moderado: number; otimista: number },
  years: number
): ProjectionPoint[] {
  const conservador = projectValue(initialValue, monthlyContribution, rates.conservador, years);
  const moderado = projectValue(initialValue, monthlyContribution, rates.moderado, years);
  const otimista = projectValue(initialValue, monthlyContribution, rates.otimista, years);

  return Array.from({ length: years + 1 }, (_, i) => ({
    year: i,
    conservador: conservador[i],
    moderado: moderado[i],
    otimista: otimista[i],
  }));
}
