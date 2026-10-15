export interface DcfParams {
  /** Caixa livre de partida (ano 0), na moeda da cotação. */
  baseFcf: number;
  /** Crescimento do 1.º ano; desce linearmente até ao crescimento terminal no ano 10. */
  growth: number;
  terminalGrowth: number;
  discountRate: number;
  netDebt: number;
  shares: number;
  years?: number;
}

/**
 * Fluxo de caixa descontado (DCF) a 10 anos + valor terminal.
 * Devolve o valor por ação, ou null se os parâmetros não fizerem sentido
 * (taxa de desconto demasiado perto do crescimento terminal, sem ações, etc.).
 */
export function dcfFairValue(p: DcfParams): { perShare: number; enterpriseValue: number; terminalShare: number } | null {
  const years = p.years ?? 10;
  if (!(p.shares > 0) || !(p.baseFcf > 0)) return null;
  if (p.discountRate - p.terminalGrowth < 0.01) return null;

  let fcf = p.baseFcf;
  let pv = 0;
  for (let t = 1; t <= years; t++) {
    const g = years > 1 ? p.growth + (p.terminalGrowth - p.growth) * ((t - 1) / (years - 1)) : p.growth;
    fcf *= 1 + g;
    pv += fcf / Math.pow(1 + p.discountRate, t);
  }
  const terminal = (fcf * (1 + p.terminalGrowth)) / (p.discountRate - p.terminalGrowth);
  const pvTerminal = terminal / Math.pow(1 + p.discountRate, years);
  const enterpriseValue = pv + pvTerminal;
  const perShare = (enterpriseValue - p.netDebt) / p.shares;
  return { perShare, enterpriseValue, terminalShare: enterpriseValue > 0 ? pvTerminal / enterpriseValue : 0 };
}
