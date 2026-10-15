import { dcfFairValue } from "./dcf";
import type { Analysis, Criterion, Group, RawFundamentals, Scenario, Status, VerdictKey, YearData } from "./types";

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

const nf = (n: number, d = 1) => n.toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x: number, d = 1) => `${nf(x * 100, d)}%`;
const mult = (x: number, d = 1) => `${nf(x, d)}×`;
const money = (x: number, cur: string) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(x);

// ---------- métricas por ano ----------
const fcfOf = (y: YearData): number | null =>
  isNum(y.fcf) ? y.fcf : isNum(y.operatingCashFlow) && isNum(y.capex) ? y.operatingCashFlow - Math.abs(y.capex) : null;
const ebitOf = (y: YearData): number | null => (isNum(y.ebit) ? y.ebit : isNum(y.operatingIncome) ? y.operatingIncome : null);
const investedCapitalOf = (y: YearData): number | null =>
  isNum(y.investedCapital)
    ? y.investedCapital
    : isNum(y.equity) && isNum(y.totalDebt)
      ? y.equity + y.totalDebt - (y.cash ?? 0)
      : null;
const netDebtOf = (y: YearData): number | null =>
  isNum(y.netDebt) ? y.netDebt : isNum(y.totalDebt) ? y.totalDebt - (y.cash ?? 0) : null;

function roicOf(y: YearData): number | null {
  const ebit = ebitOf(y);
  const ic = investedCapitalOf(y);
  if (ebit === null || ic === null || ic <= 0) return null;
  const t = isNum(y.taxRate) && y.taxRate >= 0 && y.taxRate <= 0.45 ? y.taxRate : 0.21;
  return (ebit * (1 - t)) / ic;
}

function cccOf(y: YearData): number | null {
  if (!isNum(y.revenue) || y.revenue <= 0 || !isNum(y.receivables) || !isNum(y.payables)) return null;
  const cogs = isNum(y.costOfRevenue) ? y.costOfRevenue : isNum(y.grossProfit) ? y.revenue - y.grossProfit : null;
  if (cogs === null || cogs <= 0) return null;
  const dso = (y.receivables / y.revenue) * 365;
  const dio = isNum(y.inventory) ? (y.inventory / cogs) * 365 : 0;
  const dpo = (y.payables / cogs) * 365;
  return dso + dio - dpo;
}

function cagr(values: (number | null)[]): number | null {
  const v = values.filter(isNum);
  if (v.length < 3) return null;
  const first = v[0];
  const last = v[v.length - 1];
  if (first <= 0 || last <= 0) return null;
  return Math.pow(last / first, 1 / (v.length - 1)) - 1;
}

// ---------- classificação de cada critério ----------
type Band = { good: number; ok: number };
/** Quanto MAIOR melhor. */
const higher = (x: number, b: Band): Status => (x >= b.good ? "good" : x >= b.ok ? "ok" : "bad");
/** Quanto MENOR melhor. */
const lower = (x: number, b: Band): Status => (x <= b.good ? "good" : x <= b.ok ? "ok" : "bad");

const SECTOR_KIND: Record<string, { label: string; status: Status; hint: string }> = {
  "Consumer Defensive": { label: "Defensivo", status: "good", hint: "a procura mantém-se numa recessão (bens essenciais)" },
  Utilities: { label: "Defensivo", status: "good", hint: "serviços essenciais, receitas previsíveis" },
  Healthcare: { label: "Defensivo", status: "good", hint: "a procura de saúde sofre pouco com a economia" },
  Technology: { label: "Misto", status: "ok", hint: "cresce muito, mas os orçamentos de tecnologia cortam em crises" },
  "Communication Services": { label: "Misto", status: "ok", hint: "parte da receita depende de publicidade, que é cíclica" },
  "Real Estate": { label: "Misto", status: "ok", hint: "sensível às taxas de juro" },
  "Financial Services": { label: "Misto", status: "ok", hint: "ligado ao ciclo económico e às taxas de juro" },
  "Consumer Cyclical": { label: "Cíclico", status: "ok", hint: "as vendas caem quando as pessoas cortam em gastos não essenciais" },
  Industrials: { label: "Cíclico", status: "ok", hint: "depende do investimento das empresas e do ciclo económico" },
  "Basic Materials": { label: "Cíclico", status: "ok", hint: "preços de matérias-primas sobem e descem com o ciclo" },
  Energy: { label: "Cíclico", status: "ok", hint: "depende do preço do petróleo e do gás" },
};

const RECOMMENDATION_PT: Record<string, string> = {
  strong_buy: "compra forte",
  buy: "compra",
  hold: "manter",
  underperform: "abaixo do mercado",
  sell: "venda",
  strong_sell: "venda forte",
};

export function computeAnalysis(raw: RawFundamentals): Analysis {
  const years = raw.years;
  const last = years[years.length - 1];
  const prev = years.length >= 2 ? years[years.length - 2] : undefined;
  const cur = raw.currency;

  const isEquity = raw.quoteType === "EQUITY";
  const industry = raw.industry ?? "";
  const isFinancial = /bank|insurance|mortgage/i.test(industry);
  const dataNotes: string[] = [];

  const base = (): Analysis => ({
    symbol: raw.symbol,
    name: raw.name,
    currency: cur,
    price: raw.price,
    sector: raw.sector,
    industry: raw.industry,
    isEquity,
    isFinancial,
    criteria: [],
    qualityScore: null,
    valueScore: null,
    verdict: { key: "insufficient", title: "Dados insuficientes", summary: "" },
    valuation: null,
    analyst: null,
    reasonsFor: [],
    reasonsAgainst: [],
    qualitative: [],
    dataNotes,
  });

  if (!isEquity) {
    const a = base();
    a.verdict = {
      key: "insufficient",
      title: "Análise fundamental não se aplica",
      summary: "Esta análise usa balanço e demonstração de resultados, que só existem para empresas. ETFs, fundos e criptomoedas não os têm.",
    };
    return a;
  }
  if (!last) {
    const a = base();
    a.verdict = {
      key: "insufficient",
      title: "Sem demonstrações financeiras",
      summary: "O Yahoo Finance não devolveu balanço nem demonstração de resultados para este ativo.",
    };
    return a;
  }

  // moeda de reporte vs moeda da cotação
  const fx = raw.fx ?? (raw.financialCurrency && raw.financialCurrency !== cur ? null : 1);
  if (fx === null) dataNotes.push(`A empresa reporta em ${raw.financialCurrency} e não foi possível converter para ${cur}: o valuation em preço fica de fora.`);
  else if (fx !== 1) dataNotes.push(`A empresa reporta em ${raw.financialCurrency}; os valores foram convertidos para ${cur} ao câmbio atual.`);

  const criteria: Criterion[] = [];
  const reasonsFor: { w: number; t: string }[] = [];
  const reasonsAgainst: { w: number; t: string }[] = [];

  function add(
    key: string,
    group: Group,
    label: string,
    value: number | null,
    display: (v: number) => string,
    status: (v: number) => Status,
    weight: number,
    what: string,
    reason?: (v: number, s: Status) => string | undefined
  ) {
    if (value === null || !Number.isFinite(value)) {
      criteria.push({ key, group, label, display: "n/d", status: "na", weight, what });
      return;
    }
    const s = status(value);
    const r = reason?.(value, s);
    criteria.push({ key, group, label, display: display(value), status: s, weight, what, reason: r });
    if (r && s === "good") reasonsFor.push({ w: weight, t: r });
    if (r && s === "bad") reasonsAgainst.push({ w: weight, t: r });
  }

  const fcfLast = fcfOf(last);
  const revenue = isNum(last.revenue) ? last.revenue : null;
  const ebit = ebitOf(last);

  // ================= 1. Caixa e eficiência =================
  const roic = isFinancial ? null : roicOf(last);
  add("roic", "caixa", "ROIC", roic, (v) => pct(v), (v) => higher(v, { good: 0.15, ok: 0.08 }), 3,
    "Rentabilidade do capital investido no negócio (lucro operacional depois de impostos ÷ capital investido). Acima de 15% é o que se procura.",
    (v, s) =>
      s === "good" ? `ROIC de ${pct(v)}: cada euro investido no negócio rende bem acima do mínimo de 15%.`
      : s === "bad" ? `ROIC de ${pct(v)}, abaixo dos 15% que se procuram: o capital investido rende pouco.` : undefined);
  if (roic !== null && !(isNum(last.taxRate) && last.taxRate >= 0 && last.taxRate <= 0.45))
    dataNotes.push("ROIC calculado com uma taxa de imposto assumida de 21% (o Yahoo não deu a taxa efetiva).");

  const fcfUse = fx !== null && fcfLast !== null && !isFinancial ? fcfLast * fx : null;
  add("fcfYield", "valuation", "FCF Yield", fcfUse !== null && isNum(raw.marketCap) && raw.marketCap > 0 ? fcfUse / raw.marketCap : null,
    (v) => pct(v), (v) => higher(v, { good: 0.05, ok: 0.03 }), 3,
    "Caixa livre gerado num ano ÷ valor de mercado. Mostra quanto caixa recebes por cada euro que pagas pela empresa.",
    (v, s) =>
      s === "good" ? `Gera ${pct(v)} do valor de mercado em caixa livre por ano (FCF yield): bom retorno de caixa pelo preço.`
      : s === "bad" ? `FCF yield de só ${pct(v)}: pagas muito por cada euro de caixa que a empresa gera.` : undefined);

  add("fcfMargin", "caixa", "Margem FCF", !isFinancial && fcfLast !== null && revenue ? fcfLast / revenue : null,
    (v) => pct(v), (v) => higher(v, { good: 0.1, ok: 0.05 }), 2,
    "Percentagem da receita que sobra em caixa depois de pagar todas as despesas e os investimentos (CapEx).",
    (v, s) =>
      s === "good" ? `${pct(v)} da receita vira caixa livre, depois de despesas e investimentos.`
      : s === "bad" ? `Só ${pct(v)} da receita vira caixa livre depois de investimentos.` : undefined);

  const turn = !isFinancial && revenue && isNum(last.totalAssets) && last.totalAssets > 0
    ? revenue / (prev && isNum(prev.totalAssets) && prev.totalAssets > 0 ? (last.totalAssets + prev.totalAssets) / 2 : last.totalAssets)
    : null;
  const turnPrev = !isFinancial && prev && isNum(prev.revenue) && isNum(prev.totalAssets) && prev.totalAssets > 0 ? prev.revenue / prev.totalAssets : null;
  add("assetTurnover", "caixa", "Giro do ativo", turn, (v) => `${nf(v, 2)}×`,
    (v) => (turnPrev === null ? "ok" : v >= turnPrev * 1.03 ? "good" : v <= turnPrev * 0.9 ? "bad" : "ok"), 1,
    "Receita gerada por cada euro de ativos. Compara-se com o ano anterior: a subir é eficiência a melhorar.",
    (v, s) =>
      s === "good" ? `Giro do ativo a melhorar (${nf(v, 2)}× contra ${nf(turnPrev as number, 2)}× no ano anterior).`
      : s === "bad" ? `Giro do ativo a piorar (${nf(v, 2)}× contra ${nf(turnPrev as number, 2)}×): os ativos geram menos vendas.` : undefined);

  add("ebitMargin", "caixa", "Margem EBIT", !isFinancial && ebit !== null && revenue ? ebit / revenue : null,
    (v) => pct(v), (v) => higher(v, { good: 0.15, ok: 0.08 }), 2,
    "Lucro operacional ÷ receita: a eficiência do negócio em si, sem impostos nem despesas financeiras. Varia muito por setor.",
    (v, s) =>
      s === "good" ? `Margem operacional de ${pct(v)}: o negócio é eficiente.`
      : s === "bad" ? `Margem operacional de apenas ${pct(v)}: pouco espaço para erros.` : undefined);

  // ================= 2. Saúde financeira =================
  const nd = netDebtOf(last);
  const ebitda = isNum(last.ebitda) ? last.ebitda : null;
  const ndEbitda = !isFinancial && nd !== null && ebitda !== null && ebitda > 0 ? nd / ebitda : null;
  const netCash = !isFinancial && nd !== null && nd <= 0 && ebitda !== null && ebitda > 0;
  add("netDebt", "saude", "Dívida líquida / EBITDA", netCash ? 0 : ndEbitda,
    (v) => (netCash ? "caixa líquido" : mult(v)), (v) => lower(v, { good: 2, ok: 3 }), 3,
    "Quantos anos de caixa operacional seriam precisos para pagar toda a dívida (descontando o caixa que já tem). Abaixo de 2–3× é saudável.",
    (v, s) =>
      s === "good" ? (netCash ? "Tem mais caixa do que dívida (caixa líquido): muita folga financeira." : `Dívida líquida de ${mult(v)} o EBITDA: confortável.`)
      : s === "bad" ? `Dívida líquida de ${mult(v)} o EBITDA: pesada (o ideal é abaixo de 2–3×).` : undefined);

  const interest = isNum(last.interestExpense) ? Math.abs(last.interestExpense) : null;
  const cover = !isFinancial && ebit !== null && interest !== null && interest > 0 ? ebit / interest : null;
  const noInterest = !isFinancial && ebit !== null && ebit > 0 && (interest === null || interest === 0) && nd !== null && nd <= 0;
  add("interestCover", "saude", "Cobertura de juros", noInterest ? 99 : cover,
    (v) => (noInterest ? "sem juros relevantes" : mult(v)), (v) => higher(v, { good: 5, ok: 3 }), 2,
    "EBIT ÷ despesas com juros: a facilidade em pagar os juros das dívidas. Abaixo de 3× é pouco folgado.",
    (v, s) =>
      s === "good" ? (noInterest ? "Praticamente sem dívida a pagar juros." : `O lucro operacional cobre ${mult(v)} os juros da dívida.`)
      : s === "bad" ? `O lucro operacional cobre só ${mult(v)} os juros: pouca margem se os lucros caírem.` : undefined);

  const cr = !isFinancial && isNum(last.currentAssets) && isNum(last.currentLiabilities) && last.currentLiabilities > 0
    ? last.currentAssets / last.currentLiabilities : null;
  add("currentRatio", "saude", "Liquidez corrente", cr, (v) => nf(v, 2), (v) => higher(v, { good: 1, ok: 0.8 }), 1,
    "Ativo circulante ÷ passivo circulante: capacidade de pagar o que vence nos próximos 12 meses. Deve ser maior que 1.",
    (v, s) =>
      s === "good" ? `Liquidez corrente de ${nf(v, 2)}: paga as contas de curto prazo.`
      : s === "bad" ? `Liquidez corrente de ${nf(v, 2)}: o ativo de curto prazo não cobre as dívidas de curto prazo.` : undefined);

  const ccc = isFinancial ? null : cccOf(last);
  const cccPrev = !isFinancial && prev ? cccOf(prev) : null;
  add("ccc", "saude", "Ciclo de conversão de caixa", ccc, (v) => `${nf(v, 0)} dias`, (v) => lower(v, { good: 30, ok: 90 }), 1,
    "Dias que o dinheiro fica preso em clientes e stock, menos o prazo que a empresa leva a pagar aos fornecedores. Quanto menor (ou negativo), melhor.",
    (v, s) =>
      s === "good" ? `Ciclo de conversão de caixa de ${nf(v, 0)} dias: o dinheiro volta depressa${cccPrev !== null && v < cccPrev ? " e está a melhorar" : ""}.`
      : s === "bad" ? `Ciclo de conversão de caixa longo (${nf(v, 0)} dias): muito dinheiro preso em stock e clientes.` : undefined);

  // ================= 3. Qualidade do negócio (indícios) =================
  const roics = isFinancial ? [] : years.map(roicOf).filter(isNum);
  const roicGoodYears = roics.filter((r) => r >= 0.12).length;
  add("roicConsistency", "negocio", "ROIC consistente", roics.length >= 3 ? roicGoodYears / roics.length : null,
    () => `${roicGoodYears} de ${roics.length} anos > 12%`, (v) => higher(v, { good: 0.8, ok: 0.5 }), 2,
    "Em quantos dos últimos anos o ROIC ficou acima de 12%. Rentabilidade alta e repetida é o melhor indício de uma vantagem competitiva durável (moat).",
    (v, s) =>
      s === "good" ? `ROIC acima de 12% em ${roicGoodYears} dos últimos ${roics.length} anos: indício de vantagem competitiva durável.`
      : s === "bad" ? `ROIC irregular: acima de 12% em apenas ${roicGoodYears} de ${roics.length} anos.` : undefined);

  const gms = years.map((y) => (isNum(y.revenue) && y.revenue > 0 && isNum(y.grossProfit) ? y.grossProfit / y.revenue : null)).filter(isNum);
  const gmLast = gms.length ? gms[gms.length - 1] : null;
  const gmSpread = gms.length >= 3 ? Math.max(...gms) - Math.min(...gms) : null;
  add("grossMargin", "negocio", "Poder de preços (margem bruta)", isFinancial ? null : gmLast, (v) => pct(v),
    (v) => (v >= 0.4 && (gmSpread === null || gmSpread <= 0.06) ? "good" : v >= 0.2 ? "ok" : "bad"), 1,
    "Margem bruta alta e estável sugere que a empresa consegue manter os preços sem perder clientes.",
    (v, s) =>
      s === "good" ? `Margem bruta de ${pct(v)} e estável: indício de poder de preços.`
      : s === "bad" ? `Margem bruta baixa (${pct(v)}): pouca folga para subir preços.` : undefined);

  const div = isNum(last.dividendsPaid) ? Math.abs(last.dividendsPaid) : 0;
  const buy = isNum(last.buybacks) ? Math.abs(last.buybacks) : 0;
  const payout = fcfLast !== null && fcfLast > 0 && (div > 0 || buy > 0) ? (div + buy) / fcfLast : null;
  const sharesTrend = years.map((y) => y.shares).filter(isNum);
  const sharesDown = sharesTrend.length >= 3 && sharesTrend[sharesTrend.length - 1] < sharesTrend[0] * 0.98;
  add("capitalAllocation", "negocio", "Devolução aos acionistas", isFinancial ? null : payout, (v) => `${pct(v, 0)} do FCF`,
    (v) => (v <= 1 ? "good" : v <= 1.3 ? "ok" : "bad"), 1,
    "Dividendos + recompras de ações ÷ caixa livre. Até 100% é sustentável; acima disso a empresa devolve mais do que gera.",
    (v, s) =>
      s === "good" ? `Devolve aos acionistas ${pct(v, 0)} do caixa livre (dividendos e recompras), de forma sustentável${sharesDown ? " e o número de ações tem vindo a descer" : ""}.`
      : s === "bad" ? `Devolve ${pct(v, 0)} do caixa livre: dividendos e recompras superam o caixa que gera.` : undefined);

  const sk = raw.sector ? SECTOR_KIND[raw.sector] : undefined;
  add("sector", "negocio", "Resiliência do setor", sk ? 1 : null, () => `${sk?.label ?? ""}`,
    () => sk?.status ?? "na", 0.5,
    "Quanto a procura aguenta uma recessão. Setores defensivos (saúde, serviços essenciais, bens de consumo básicos) são mais resilientes.",
    () => (sk && sk.status === "good" ? `Setor ${sk.label.toLowerCase()}: ${sk.hint}.` : undefined));

  // ================= 4. Valuation =================
  const evEbitda = !isFinancial
    ? isNum(raw.enterpriseToEbitda) && raw.enterpriseToEbitda > 0
      ? raw.enterpriseToEbitda
      : fx !== null && isNum(raw.marketCap) && nd !== null && ebitda !== null && ebitda > 0
        ? (raw.marketCap + nd * fx) / (ebitda * fx)
        : null
    : null;
  add("evEbitda", "valuation", "EV / EBITDA", evEbitda, (v) => mult(v), (v) => lower(v, { good: 10, ok: 16 }), 2,
    "Valor total do negócio (incluindo dívida) ÷ caixa operacional. Mais baixo = mais barato. O que é 'caro' varia por setor.",
    (v, s) =>
      s === "good" ? `EV/EBITDA de ${mult(v)}: preço razoável pelo negócio todo.`
      : s === "bad" ? `EV/EBITDA de ${mult(v)}: preço exigente pelo caixa operacional que gera.` : undefined);

  const peg = isNum(raw.pegRatio) && raw.pegRatio > 0
    ? raw.pegRatio
    : isNum(raw.forwardPE) && raw.forwardPE > 0 && isNum(raw.earningsGrowth) && raw.earningsGrowth > 0
      ? raw.forwardPE / (raw.earningsGrowth * 100)
      : null;
  add("peg", "valuation", "PEG", peg, (v) => nf(v, 2), (v) => lower(v, { good: 1, ok: 2 }), 2,
    "P/E ÷ crescimento esperado dos lucros. Abaixo de 1 o preço é baixo para o crescimento; acima de 2 é caro. Não penaliza o crescimento rápido só por ter P/E alto.",
    (v, s) =>
      s === "good" ? `PEG de ${nf(v, 2)}: o preço é razoável para o crescimento esperado.`
      : s === "bad" ? `PEG de ${nf(v, 2)}: o crescimento esperado não justifica o preço.` : undefined);

  // ---------- DCF ----------
  let valuation: Analysis["valuation"] = null;
  const fcfs = years.map(fcfOf).filter(isNum);
  const baseFcfRaw = fcfs.length ? fcfs.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, fcfs.length) : null;
  const netDebtRaw = nd;
  const shares = isNum(raw.sharesOutstanding) && raw.sharesOutstanding > 0 ? raw.sharesOutstanding : isNum(last.shares) ? last.shares : null;

  if (isFinancial) {
    dataNotes.push("Bancos e seguradoras não se avaliam bem por caixa livre: o DCF e várias métricas ficam de fora. Para estes, usa P/VP e ROE.");
  } else if (fx === null) {
    /* nota já adicionada */
  } else if (baseFcfRaw === null || baseFcfRaw <= 0) {
    dataNotes.push("Caixa livre negativo ou em falta: o DCF não é fiável para esta empresa.");
  } else if (shares === null || netDebtRaw === null || !isNum(raw.price)) {
    dataNotes.push("Faltam dados (ações em circulação, dívida ou preço) para calcular o DCF.");
  } else {
    const growthEst = [cagr(years.map((y) => (isNum(y.revenue) ? y.revenue : null))), cagr(years.map(fcfOf))].filter(isNum);
    const growth = growthEst.length ? clamp(growthEst.reduce((a, b) => a + b, 0) / growthEst.length, 0, 0.15) : 0.04;
    const growthSource = growthEst.length
      ? `média do crescimento anual da receita e do caixa livre nos últimos anos (limitado a 0–15%)`
      : "sem histórico suficiente: assumido 4%";
    const rf = 0.04;
    const erp = 0.05;
    const beta = isNum(raw.beta) ? raw.beta : null;
    const discount = clamp(rf + (beta ?? 1) * erp, 0.07, 0.12);

    const inputs = { baseFcf: baseFcfRaw * fx, netDebt: netDebtRaw * fx, shares };
    const mk = (key: Scenario["key"], label: string, g: number, tg: number, r: number): Scenario => {
      const rr = Math.max(r, tg + 0.02);
      return { key, label, growth: g, terminalGrowth: tg, discountRate: rr, fairValue: dcfFairValue({ ...inputs, growth: g, terminalGrowth: tg, discountRate: rr })?.perShare ?? null };
    };
    const scenarios = [
      mk("pessimista", "Pessimista", growth * 0.5, 0.015, discount + 0.015),
      mk("realista", "Realista", growth, 0.025, discount),
      mk("otimista", "Otimista", Math.min(growth * 1.3, 0.2), 0.03, Math.max(discount - 0.01, 0.06)),
    ];
    const fair = scenarios[1].fairValue;
    const upside = fair !== null && fair > 0 && raw.price > 0 ? fair / raw.price - 1 : null;
    valuation = { scenarios, fairValue: fair !== null && fair > 0 ? fair : null, upside, inputs, assumptions: { growth, terminalGrowth: 0.025, discountRate: discount, beta, growthSource } };

    add("dcf", "valuation", "Valor estimado (DCF)", upside, (v) => `${v >= 0 ? "+" : ""}${pct(v, 0)} vs preço`,
      (v) => (v >= 0.2 ? "good" : v >= -0.15 ? "ok" : "bad"), 4,
      "Quanto valem os caixas futuros da empresa, trazidos para hoje. Compara o valor estimado com o preço de mercado: positivo = a ação está abaixo do que vale.",
      (v, s) =>
        s === "good" ? `Valor estimado de ${money(fair as number, cur)} contra ${money(raw.price as number, cur)} no mercado: margem de segurança de ${pct(v / (1 + v), 0)}.`
        : s === "bad" ? `A cotação (${money(raw.price as number, cur)}) está ${pct(-v / (1 + v), 0)} acima do valor estimado (${money(fair as number, cur)}): já desconta muito otimismo.` : undefined);
  }
  if (!criteria.some((c) => c.key === "dcf")) {
    criteria.push({ key: "dcf", group: "valuation", label: "Valor estimado (DCF)", display: "n/d", status: "na", weight: 4,
      what: "Quanto valem os caixas futuros da empresa, trazidos para hoje, comparado com o preço de mercado." });
  }

  // ---------- pontuações ----------
  const pts: Record<Status, number> = { good: 1, ok: 0.5, bad: 0, na: 0 };
  const score = (cs: Criterion[]) => {
    const avail = cs.filter((c) => c.status !== "na");
    const w = avail.reduce((s, c) => s + c.weight, 0);
    return avail.length >= 3 && w > 0 ? Math.round((avail.reduce((s, c) => s + pts[c.status] * c.weight, 0) / w) * 100) : null;
  };
  const qualityScore = score(criteria.filter((c) => c.group !== "valuation"));
  const valueScore = score(criteria.filter((c) => c.group === "valuation"));
  const available = criteria.filter((c) => c.status !== "na").length;

  const upsideNow = valuation?.upside ?? null;
  let key: VerdictKey;
  let title: string;
  let summary: string;
  if (years.length < 3) {
    key = "insufficient";
    title = "Histórico curto demais";
    summary = `Só há ${years.length} ano(s) de demonstrações financeiras: pouco para avaliar consistência. Vê as razões abaixo como indícios, não como veredicto.`;
  } else if (available < 6 || qualityScore === null) {
    key = "insufficient";
    title = "Dados insuficientes";
    summary = "O Yahoo não deu métricas suficientes para uma conclusão fiável. Vê as razões abaixo como indícios, não como veredicto.";
  } else if (qualityScore >= 65 && (valueScore ?? 0) >= 60) {
    key = "buy";
    title = "Boa empresa a um preço atrativo";
    summary = "Os números de qualidade são sólidos e o preço não parece exigente. É das que merecem ser estudadas para comprar.";
  } else if (qualityScore >= 65) {
    key = "expensive";
    title = "Boa empresa, mas cara";
    summary = "O negócio parece forte, mas o preço já desconta muito. Pode fazer sentido esperar por uma cotação melhor.";
  } else if (qualityScore >= 45 && (valueScore ?? 0) >= 60) {
    key = "watch";
    title = "Preço atrativo, negócio só razoável";
    summary = "Está barata face aos números, mas a qualidade não é top. Compensa só se perceberes bem porque está barata.";
  } else if (qualityScore < 45) {
    key = "avoid";
    title = "Qualidade fraca: evitar";
    summary = "Vários indicadores de rentabilidade, caixa ou solidez estão fracos. Só com uma razão muito forte.";
  } else {
    key = "watch";
    title = "Neutra: acompanhar";
    summary = "Nem claramente boa nem claramente má a este preço. Fica no radar à espera de um sinal mais claro.";
  }
  if (key === "buy" && upsideNow !== null && upsideNow < 0) {
    key = "expensive";
    title = "Boa empresa, mas cara";
    summary = "O negócio parece forte, mas segundo o DCF a cotação já está acima do valor estimado.";
  }

  // ---------- indícios qualitativos ----------
  const qualitative: Analysis["qualitative"] = [
    {
      label: "Vantagem competitiva (moat)",
      hint: roics.length >= 3
        ? `Indício nos números: ROIC acima de 12% em ${roicGoodYears} de ${roics.length} anos${gmLast !== null ? ` e margem bruta de ${pct(gmLast, 0)}` : ""}. Falta avaliar patentes, custos de troca e efeito de rede.`
        : "Sem histórico suficiente nos números. Avalia patentes, custos de troca para o cliente, efeito de rede e poder de preços.",
    },
    {
      label: "Alinhamento da gestão",
      hint: isNum(raw.insidersPercent)
        ? `Insiders detêm ${pct(raw.insidersPercent, 2)} das ações${raw.insidersPercent < 0.005 ? " (comum em empresas muito grandes)" : ""}. Falta ver se os bónus estão ligados ao ROIC ou ao valor de longo prazo.`
        : "Não há dados sobre as ações detidas pelos gestores. Procura no relatório de remunerações se os bónus dependem do ROIC.",
    },
    {
      label: "Alocação de capital",
      hint: payout !== null
        ? `Devolve ${pct(payout, 0)} do caixa livre em dividendos e recompras${sharesDown ? "; o número de ações desceu" : ""}. Falta avaliar se as aquisições passadas criaram valor.`
        : "Sem dados de dividendos e recompras. Vê se as aquisições passadas criaram valor e se compra ações quando estão baratas.",
    },
    {
      label: "Resiliência do setor",
      hint: sk ? `Setor ${raw.sector}: ${sk.label.toLowerCase()} — ${sk.hint}.` : "Setor não identificado: avalia o que acontece à procura numa recessão.",
    },
  ];

  const missing = criteria.filter((c) => c.status === "na").map((c) => c.label);
  if (missing.length && !isFinancial) dataNotes.push(`Sem dados para: ${missing.join(", ")}.`);
  if (years.length < 4) dataNotes.push(`Só há ${years.length} ano(s) de histórico: as médias e a consistência são menos fiáveis.`);

  const top = (xs: { w: number; t: string }[]) => xs.sort((a, b) => b.w - a.w).slice(0, 6).map((x) => x.t);

  return {
    symbol: raw.symbol,
    name: raw.name,
    currency: cur,
    price: raw.price,
    sector: raw.sector,
    industry: raw.industry,
    isEquity,
    isFinancial,
    criteria,
    qualityScore,
    valueScore,
    verdict: { key, title, summary },
    valuation,
    analyst: isNum(raw.targetMean) || raw.recommendation
      ? { mean: raw.targetMean, low: raw.targetLow, high: raw.targetHigh, count: raw.analystCount, recommendation: raw.recommendation ? RECOMMENDATION_PT[raw.recommendation] ?? raw.recommendation : null }
      : null,
    reasonsFor: top(reasonsFor),
    reasonsAgainst: top(reasonsAgainst),
    qualitative,
    dataNotes,
  };
}
