import Papa from "papaparse";
import { normalize, parseEuroNumber, parseDegiroDate, combineDateTime, sha256Hex } from "./format";
import type { AssetOperation } from "@/types/database";

/**
 * =========================================================================
 * PARSER DE CSV DA DEGIRO
 * =========================================================================
 * Dois exports distintos:
 *   1. "Transacções"   — uma linha por execução de bolsa (Quantidade e Preço explícitos).
 *   2. "Estado de Conta" — movimentos de caixa; a operação é inferida do texto da Descrição.
 *
 * Deteta o formato pelo cabeçalho e lida com delimitador ";" ou ",", números
 * europeus, colunas de moeda sem nome e datas "dd-mm-aaaa".
 * =========================================================================
 */

export interface ParsedDegiroRow {
  rowIndex: number;
  date: string; // ISO aaaa-mm-dd
  datetime: string | null;
  product: string;
  isin: string | null;
  operation: AssetOperation;
  quantity: number | null;
  price: number | null;
  localValue: number | null;
  fees: number;
  /** Fluxo de caixa COM SINAL (compra < 0, venda > 0). */
  totalValue: number;
  currency: string;
  exchangeRate: number | null;
  description: string;
  orderId: string | null;
  /** Saldo da conta reportado pela DEGIRO nesta linha, se existir. */
  balance: number | null;
  /** Hash estável da linha original — usado para deduplicação. */
  sourceHash: string;
  raw: Record<string, string>;
}

export interface DegiroParseResult {
  format: "transacoes" | "estado_conta" | "desconhecido";
  rows: ParsedDegiroRow[];
  warnings: string[];
  skipped: number;
  latestBalance: { balance: number; occurredAt: string } | null;
}

function detectDelimiter(sampleLine: string): string {
  const semicolons = (sampleLine.match(/;/g) || []).length;
  const commas = (sampleLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseRaw(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const result = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: true });
  return result.data as string[][];
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["data", "date", "fecha"],
  time: ["hora", "time", "hora local"],
  valueDate: ["data valor", "value date", "fecha valor"],
  product: ["produto", "product", "producto"],
  isin: ["isin"],
  quantity: ["quantidade", "quantity", "cantidad"],
  price: ["preco", "price", "precio"],
  localValue: ["valor local", "local value", "valor en moneda local"],
  value: ["valor", "value", "importe", "mutacao", "mutation", "change", "mudanca", "variacao", "variation", "variacion"],
  exchangeRate: ["taxa de cambio", "exchange rate", "tipo de cambio", "fx"],
  fees: ["custos de transacao", "transaction fee", "transaction costs", "costes de transaccion"],
  total: ["total"],
  description: ["descricao", "description", "descripcion"],
  orderId: ["id da ordem", "id ordem", "order id", "id de la orden"],
  balance: ["saldo", "balance"],
};

function normHeader(h: string): string {
  return normalize(h).replace(/\s+/g, " ");
}

function resolveColumns(header: string[]): Record<string, number> {
  const normalized = header.map(normHeader);
  const cols: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    // 1ª passagem: correspondência exata (evita "Data valor" ser lida como "Valor").
    let idx = normalized.findIndex((h) => aliases.includes(h));
    // 2ª passagem: parcial, mas o campo "value" nunca aceita colunas de data.
    if (idx === -1) {
      idx = normalized.findIndex(
        (h) =>
          h !== "" &&
          !(field === "value" && h.includes("data")) &&
          aliases.some((a) => h.includes(a))
      );
    }
    if (idx !== -1) cols[field] = idx;
  }
  return cols;
}

/**
 * A DEGIRO exporta por vezes pares [código de moeda][valor] em que a coluna
 * da moeda não tem cabeçalho. Deteta o padrão e devolve valor + moeda.
 */
function resolveValueAndCurrency(
  row: string[],
  idx: number | undefined
): { value: number | null; currency: string | null } {
  if (idx === undefined) return { value: null, currency: null };
  const cell = (row[idx] ?? "").trim();
  if (/^[A-Z]{3}$/.test(cell)) {
    return { value: parseEuroNumber(row[idx + 1]), currency: cell };
  }
  const nextCell = (row[idx + 1] ?? "").trim();
  if (/^[A-Z]{3}$/.test(nextCell)) {
    return { value: parseEuroNumber(cell), currency: nextCell };
  }
  return { value: parseEuroNumber(cell), currency: null };
}

const KEYWORDS: Record<AssetOperation, string[]> = {
  compra: ["compra", "buy", "compra de acciones"],
  venda: ["venda", "sell", "venta"],
  dividendo: ["dividendo", "dividend", "dividend tax", "imposto sobre dividendo", "retencao de imposto"],
  comissao: [
    "custos de transacao",
    "comissao",
    "comiss",
    "transaction fee",
    "transaction costs",
    "connectivity fee",
    "taxa de conectividade",
    "custo de conectividade",
    "conectividade",
    "corretagem",
    "exchange connection fee",
    "costes de conexion",
  ],
  outro: [],
};

export function classifyOperation(description: string, quantity: number | null): AssetOperation {
  const text = normalize(description);

  // O verbo no INÍCIO do texto manda: "Compra 3 iShares Euro Dividend..." é uma
  // compra, mesmo que o nome do produto contenha a palavra "dividend".
  const lead = text.match(/^(compra|buy|venda|sell|venta)\b/);
  if (lead) return lead[1] === "compra" || lead[1] === "buy" ? "compra" : "venda";

  for (const op of ["dividendo", "comissao", "compra", "venda"] as const) {
    if (KEYWORDS[op].some((kw) => text.includes(normalize(kw)))) return op;
  }
  if (quantity !== null) return quantity > 0 ? "compra" : quantity < 0 ? "venda" : "outro";
  return "outro";
}

/** Extrai quantidade e preço do texto livre do "Estado de Conta" ("Compra 3 SAP SE@147,54 EUR (ISIN)"). */
function extractQtyPriceFromText(text: string): { quantity: number | null; price: number | null } {
  const withVerb = text.match(/^(?:compra|venda|buy|sell)\s+(\d+(?:[.,]\d+)?)\s+.+?@\s*(\d+(?:[.,]\d+)?)/i);
  if (withVerb) {
    return { quantity: parseEuroNumber(withVerb[1]), price: parseEuroNumber(withVerb[2]) };
  }
  const generic = text.match(/(\d+[.,]?\d*)\s*(?:@|a)\s*(\d+[.,]?\d*)/i);
  if (!generic) return { quantity: null, price: null };
  return { quantity: parseEuroNumber(generic[1]), price: parseEuroNumber(generic[2]) };
}

export async function parseDegiroCsv(text: string): Promise<DegiroParseResult> {
  const table = parseRaw(text);
  if (table.length < 2) {
    return {
      format: "desconhecido",
      rows: [],
      warnings: ["Ficheiro vazio ou sem linhas de dados."],
      skipped: 0,
      latestBalance: null,
    };
  }

  const header = table[0];
  const cols = resolveColumns(header);
  const warnings: string[] = [];

  if (cols.date === undefined || cols.product === undefined) {
    warnings.push(
      "Não foi possível reconhecer as colunas 'Data' e 'Produto'. Verifica se exportaste o CSV correto da DEGIRO."
    );
  }

  const format: DegiroParseResult["format"] =
    cols.quantity !== undefined && cols.price !== undefined
      ? "transacoes"
      : cols.description !== undefined
      ? "estado_conta"
      : "desconhecido";

  const rows: ParsedDegiroRow[] = [];
  let skipped = 0;
  let cashRowsSkipped = 0;
  let latestBalance: DegiroParseResult["latestBalance"] = null;
  // Linhas idênticas dentro do mesmo ficheiro (ex: duas execuções parciais iguais)
  // recebem um sufixo de ocorrência no hash, para não serem confundidas com duplicados.
  const seenLines = new Map<string, number>();

  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    if (!raw || raw.every((c) => !c || c.trim() === "")) continue;

    const isoDate = parseDegiroDate(cols.date !== undefined ? raw[cols.date] : undefined);
    if (!isoDate) {
      skipped++;
      continue;
    }

    const time = cols.time !== undefined ? raw[cols.time] : undefined;
    const occurredAt = combineDateTime(isoDate, time) ?? `${isoDate}T00:00:00`;

    const rowBalance = resolveValueAndCurrency(raw, cols.balance).value;
    if (rowBalance !== null && (!latestBalance || occurredAt > latestBalance.occurredAt)) {
      latestBalance = { balance: rowBalance, occurredAt };
    }

    const rawProduct = (cols.product !== undefined ? raw[cols.product] : "")?.trim() || "";
    const isin = cols.isin !== undefined ? raw[cols.isin]?.trim() || null : null;

    if (format === "estado_conta" && !rawProduct && !isin) {
      cashRowsSkipped++;
      continue;
    }

    const product = rawProduct || "(sem nome)";
    const description = cols.description !== undefined ? raw[cols.description]?.trim() || "" : `${product}`;
    const orderId = cols.orderId !== undefined ? raw[cols.orderId]?.trim() || null : null;

    let quantity = cols.quantity !== undefined ? parseEuroNumber(raw[cols.quantity]) : null;
    let price = cols.price !== undefined ? parseEuroNumber(raw[cols.price]) : null;

    if (quantity === null && price === null && description) {
      const extracted = extractQtyPriceFromText(description);
      quantity = extracted.quantity;
      price = extracted.price;
    }

    const localValueRes = resolveValueAndCurrency(raw, cols.localValue);
    const valueRes = resolveValueAndCurrency(raw, cols.value);
    const totalRes = resolveValueAndCurrency(raw, cols.total);
    const feesRes = resolveValueAndCurrency(raw, cols.fees);
    const exchangeRate = cols.exchangeRate !== undefined ? parseEuroNumber(raw[cols.exchangeRate]) : null;

    const totalValue = totalRes.value ?? valueRes.value ?? localValueRes.value ?? 0;
    const currency = totalRes.currency ?? valueRes.currency ?? localValueRes.currency ?? "EUR";
    const fees = Math.abs(feesRes.value ?? 0);

    // No CSV de Transações não há descrição (só o nome do produto, que pode conter
    // "Dividend", "Sell"...), por isso a operação vem SÓ do sinal da quantidade.
    const operation: AssetOperation =
      format === "transacoes" && quantity !== null && quantity !== 0
        ? quantity > 0
          ? "compra"
          : "venda"
        : classifyOperation(description || product, quantity);

    const lineKey = raw.join("|");
    const occurrence = seenLines.get(lineKey) ?? 0;
    seenLines.set(lineKey, occurrence + 1);
    // 1ª ocorrência mantém o hash antigo => importações já feitas continuam a deduplicar.
    const sourceHash = await sha256Hex(occurrence === 0 ? lineKey : `${lineKey}#${occurrence}`);

    const rawRecord: Record<string, string> = {};
    header.forEach((h, idx) => (rawRecord[h || `col_${idx}`] = raw[idx] ?? ""));

    rows.push({
      rowIndex: i,
      date: isoDate,
      datetime: occurredAt,
      product,
      isin,
      operation,
      quantity: quantity !== null ? Math.abs(quantity) : null,
      price: price !== null ? Math.abs(price) : null,
      localValue: localValueRes.value,
      fees,
      totalValue,
      currency,
      exchangeRate,
      description: description || product,
      orderId,
      balance: rowBalance,
      sourceHash,
      raw: rawRecord,
    });
  }

  if (skipped > 0) {
    warnings.push(`${skipped} linha(s) ignorada(s) por não terem uma data válida.`);
  }
  if (cashRowsSkipped > 0) {
    warnings.push(
      `${cashRowsSkipped} movimento(s) de caixa (depósitos, levantamentos, juros, cash sweep) ignorado(s) por não estarem associados a nenhum ativo.`
    );
  }
  if (rows.some((r) => r.totalValue === 0)) {
    warnings.push("Há linhas com valor 0 — confirma se o CSV tem a coluna de valores (Total/Valor/Variação).");
  }

  return { format, rows, warnings, skipped, latestBalance };
}

/** Hash do ficheiro inteiro (usado para detetar reimportação do mesmo CSV). */
export async function hashFileContent(text: string): Promise<string> {
  return sha256Hex(text);
}
