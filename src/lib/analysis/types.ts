/** Um ano fiscal (anual) de demonstrações financeiras. Valores na moeda de reporte da empresa. */
export interface YearData {
  /** Data de fecho do exercício (aaaa-mm-dd). */
  date: string;
  year: number;
  revenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  ebit?: number;
  ebitda?: number;
  interestExpense?: number;
  netIncome?: number;
  taxRate?: number;
  operatingCashFlow?: number;
  capex?: number;
  fcf?: number;
  dividendsPaid?: number;
  buybacks?: number;
  totalAssets?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  receivables?: number;
  inventory?: number;
  payables?: number;
  cash?: number;
  totalDebt?: number;
  netDebt?: number;
  equity?: number;
  investedCapital?: number;
  shares?: number;
}

/** Tudo o que vem do Yahoo (já normalizado), antes de qualquer cálculo. */
export interface RawFundamentals {
  symbol: string;
  name: string;
  /** Moeda da cotação (ex: EUR). */
  currency: string;
  quoteType: string;
  price: number | null;
  marketCap: number | null;
  sharesOutstanding: number | null;
  enterpriseValue: number | null;
  beta: number | null;
  pegRatio: number | null;
  forwardPE: number | null;
  trailingPE: number | null;
  enterpriseToEbitda: number | null;
  sector: string | null;
  industry: string | null;
  /** % das ações detidas por insiders (0 a 1). */
  insidersPercent: number | null;
  targetMean: number | null;
  targetLow: number | null;
  targetHigh: number | null;
  analystCount: number | null;
  recommendation: string | null;
  earningsGrowth: number | null;
  /** Moeda em que a empresa reporta, se diferir da da cotação. */
  financialCurrency: string | null;
  /** Multiplicador moeda de reporte → moeda da cotação (1 se for a mesma; null se não foi possível obter). */
  fx: number | null;
  /** Anos por ordem crescente. */
  years: YearData[];
}

export type Status = "good" | "ok" | "bad" | "na";
export type Group = "caixa" | "saude" | "negocio" | "valuation";

export const GROUP_LABEL: Record<Group, string> = {
  caixa: "Caixa e eficiência",
  saude: "Saúde financeira e risco",
  negocio: "Qualidade do negócio (indícios)",
  valuation: "Valuation",
};

export interface Criterion {
  key: string;
  group: Group;
  label: string;
  /** Valor já formatado para mostrar ("18,4%", "2,1×", "n/d"). */
  display: string;
  status: Status;
  /** Peso na pontuação. */
  weight: number;
  /** O que é e como se lê (frase curta). */
  what: string;
  /** Frase a favor / contra, com números (só uma das duas, conforme o estado). */
  reason?: string;
}

export type VerdictKey = "buy" | "expensive" | "watch" | "avoid" | "insufficient";

export interface Scenario {
  key: "pessimista" | "realista" | "otimista";
  label: string;
  growth: number;
  terminalGrowth: number;
  discountRate: number;
  /** Valor estimado por ação, na moeda da cotação. */
  fairValue: number | null;
}

export interface Valuation {
  scenarios: Scenario[];
  /** Valor estimado (cenário realista) e quanto a cotação está acima/abaixo (positivo = subvalorizada). */
  fairValue: number | null;
  upside: number | null;
  /** Entradas do DCF, já na moeda da cotação — usadas pela calculadora interativa. */
  inputs: { baseFcf: number; netDebt: number; shares: number };
  assumptions: { growth: number; terminalGrowth: number; discountRate: number; beta: number | null; growthSource: string };
}

export interface Analysis {
  symbol: string;
  name: string;
  currency: string;
  price: number | null;
  sector: string | null;
  industry: string | null;
  isEquity: boolean;
  isFinancial: boolean;
  criteria: Criterion[];
  qualityScore: number | null;
  valueScore: number | null;
  verdict: { key: VerdictKey; title: string; summary: string };
  valuation: Valuation | null;
  analyst: { mean: number | null; low: number | null; high: number | null; count: number | null; recommendation: string | null } | null;
  reasonsFor: string[];
  reasonsAgainst: string[];
  qualitative: { label: string; hint: string }[];
  dataNotes: string[];
}
