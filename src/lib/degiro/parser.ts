import Papa from "papaparse";
import { normalize, parseEuroNumber, parseDegiroDate, combineDateTime, sha256Hex } from "./format";
import type { AssetOperation } from "@/types/database";

/**
 * =========================================================================
 * PARSER DE CSV DA DEGIRO
 * =========================================================================
 * A DEGIRO tem, na prática, dois exports distintos que os utilizadores
 * costumam carregar:
 *
 *   1. "Transacções" (Transactions.csv)  — uma linha por execução de bolsa,
 *      com colunas explícitas de Quantidade e Preço.
 *
 *   2. "Estado de Conta" (Account.csv)   — um extrato de movimentos de caixa
 *      (compras, vendas, dividendos, comissões, depósitos...) onde a
 *      operação tem de ser inferida a partir do texto livre da coluna
 *      "Descrição" / "Mutação".
 *
 * Este parser deteta automaticamente o formato pelo cabeçalho e lida com:
 *   - delimitador ";" (locale PT/ES) ou "," (locale EN/US)
 *   - números europeus "1.234,56"
 *   - colunas de moeda "sem nome" que a DEGIRO intercala a seguir a cada
 *     coluna de valor (ex: [Valor Local] [ ] -> moeda | valor)
 *   - datas "dd-mm-aaaa"
 * =========================================================================
 */

export interface ParsedDegiroRow {
  /** Índice da linha no ficheiro original (para mostrar erros ao utilizador). */
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
  totalValue: number;
  currency: string;
  exchangeRate: number | null;
  description: string;
  orderId: string | null;
  /** Hash estável da linha original — usado para deduplicação. */
  sourceHash: string;
  /** Linha crua (mapa header->valor) guardada para auditoria. */
  raw: Record<string, string>;
}

export interface DegiroParseResult {
  format: "transacoes" | "estado_conta" | "desconhecido";
  rows: ParsedDegiroRow[];
  warnings: string[];
  skipped: number;
}

// ---------------------------------------------------------------------
// Deteção de delimitador e leitura crua do CSV
// ---------------------------------------------------------------------

function detectDelimiter(sampleLine: string): string {
  const semicolons = (sampleLine.match(/;/g) || []).length;
  const commas = (sampleLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

/** Faz parse cru do texto CSV para array de arrays de strings. */
function parseRaw(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const result = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: true,
  });
  return result.data as string[][];
}

// ---------------------------------------------------------------------
// Resolução de colunas por "fuzzy matching" de aliases
// ---------------------------------------------------------------------

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["data", "date", "fecha"],
  time: ["hora", "time", "hora local"],
  valueDate: ["data valor", "value date", "fecha valor"],
  product: ["produto", "product", "producto"],
  isin: ["isin"],
  quantity: ["quantidade", "quantity", "cantidad"],
  price: ["preco", "price", "precio"],
  localValue: ["valor local", "local value", "valor en moneda local"],
  value: ["valor", "value", "importe", "mutacao", "mutação", "mutation", "change"],
  exchangeRate: ["taxa de cambio", "taxa de câmbio", "exchange rate", "tipo de cambio"],
  fees: ["custos de transacao", "custos de transação", "transaction fee", "transaction costs", "costes de transaccion"],
  total: ["total"],
  description: ["descricao", "descrição", "description", "descripcion"],
  orderId: ["id da ordem", "id ordem", "order id", "id de la orden"],
  balance: ["saldo", "balance"],
};

/** Normaliza um cabeçalho para comparação (sem acentos, minúsculas, sem excesso de espaço). */
function normHeader(h: string): string {
  return normalize(h).replace(/\s+/g, " ");
}

/**
 * Localiza, para cada campo lógico, o índice da coluna correspondente no
 * cabeçalho, tentando todos os aliases conhecidos.
 */
function resolveColumns(header: string[]): Record<string, number> {
  const normalized = header.map(normHeader);
  const cols: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    // 1ª passagem: correspondência exata (evita que "Data valor" seja
    // confundido com a coluna "Valor" só porque contém essa substring).
    let idx = normalized.findIndex((h) => aliases.includes(h));
    // 2ª passagem: correspondência parcial, só usada se nada bateu certo.
    if (idx === -1) {
      idx = normalized.findIndex((h) => h !== "" && aliases.some((a) => h.includes(a)));
    }
    if (idx !== -1) cols[field] = idx;
  }
  return cols;
}

/**
 * A DEGIRO por vezes exporta um par [código de moeda][valor] onde a coluna
 * do código de moeda não tem cabeçalho (fica em branco). Quando isso
 * acontece, o valor numérico está na coluna seguinte à que encontrámos.
 * Esta função deteta esse padrão: se a célula na posição `idx` parecer um
 * código de moeda (3 letras maiúsculas) em vez de um número, avança 1.
 */
function resolveValueAndCurrency(
  row: string[],
  idx: number | undefined
): { value: number | null; currency: string | null } {
  if (idx === undefined) return { value: null, currency: null };
  const cell = (row[idx] ?? "").trim();
  if (/^[A-Z]{3}$/.test(cell)) {
    // A própria coluna resolvida é o código de moeda -> o valor está a seguir.
    return { value: parseEuroNumber(row[idx + 1]), currency: cell };
  }
  // Verifica se a coluna seguinte é que traz o código de moeda (par invertido).
  const nextCell = (row[idx + 1] ?? "").trim();
  if (/^[A-Z]{3}$/.test(nextCell)) {
    return { value: parseEuroNumber(cell), currency: nextCell };
  }
  return { value: parseEuroNumber(cell), currency: null };
}

// ---------------------------------------------------------------------
// Classificação da operação a partir do texto livre (Descrição / Mutação)
// ---------------------------------------------------------------------

const KEYWORDS: Record<AssetOperation, string[]> = {
  compra: ["compra", "buy", "compra de acciones"],
  venda: ["venda", "sell", "venta"],
  dividendo: ["dividendo", "dividend", "dividend tax", "imposto sobre dividendo", "retencao de imposto"],
  comissao: [
    "custos de transacao",
    "custos de transação",
    "comissao",
    "comissão",
    "transaction fee",
    "transaction costs",
    "connectivity fee",
    "taxa de conectividade",
    "corretagem",
    "exchange connection fee",
    "costes de conexion",
  ],
  outro: [],
};

export function classifyOperation(description: string, quantity: number | null): AssetOperation {
  const text = normalize(description);
  for (const op of ["dividendo", "comissao", "compra", "venda"] as const) {
    if (KEYWORDS[op].some((kw) => text.includes(normalize(kw)))) return op;
  }
  // Sem correspondência textual: usa o sinal da quantidade como último recurso.
  if (quantity !== null) return quantity > 0 ? "compra" : quantity < 0 ? "venda" : "outro";
  return "outro";
}

/** Tenta extrair quantidade e preço embutidos no texto livre, ex: "Compra 10 @ 25,30 EUR". */
function extractQtyPriceFromText(text: string): { quantity: number | null; price: number | null } {
  const m = text.match(/(\d+[.,]?\d*)\s*(?:@|a)\s*(\d+[.,]?\d*)/i);
  if (!m) return { quantity: null, price: null };
  return { quantity: parseEuroNumber(m[1]), price: parseEuroNumber(m[2]) };
}

// ---------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------

export async function parseDegiroCsv(text: string): Promise<DegiroParseResult> {
  const table = parseRaw(text);
  if (table.length < 2) {
    return { format: "desconhecido", rows: [], warnings: ["Ficheiro vazio ou sem linhas de dados."], skipped: 0 };
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

  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    if (!raw || raw.every((c) => !c || c.trim() === "")) continue;

    const isoDate = parseDegiroDate(cols.date !== undefined ? raw[cols.date] : undefined);
    if (!isoDate) {
      skipped++;
      continue;
    }

    const product = (cols.product !== undefined ? raw[cols.product] : "")?.trim() || "(sem nome)";
    const isin = cols.isin !== undefined ? raw[cols.isin]?.trim() || null : null;
    const description =
      cols.description !== undefined ? raw[cols.description]?.trim() || "" : `${product}`;
    const orderId = cols.orderId !== undefined ? raw[cols.orderId]?.trim() || null : null;
    const time = cols.time !== undefined ? raw[cols.time] : undefined;

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

    // Valor total em EUR: preferimos a coluna "Total"; se não existir, usamos
    // "Valor" (extrato de conta); em último caso o valor local.
    const totalValue = totalRes.value ?? valueRes.value ?? localValueRes.value ?? 0;
    const currency = totalRes.currency ?? valueRes.currency ?? localValueRes.currency ?? "EUR";
    const fees = Math.abs(feesRes.value ?? 0);

    const operation = classifyOperation(description || product, quantity);

    const rowForHash = raw.join("|");
    const sourceHash = await sha256Hex(rowForHash);

    const rawRecord: Record<string, string> = {};
    header.forEach((h, idx) => (rawRecord[h || `col_${idx}`] = raw[idx] ?? ""));

    rows.push({
      rowIndex: i,
      date: isoDate,
      datetime: combineDateTime(isoDate, time),
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
      sourceHash,
      raw: rawRecord,
    });
  }

  if (skipped > 0) {
    warnings.push(`${skipped} linha(s) ignorada(s) por não terem uma data válida.`);
  }

  return { format, rows, warnings, skipped };
}

/** Hash do ficheiro inteiro (usado para detetar reimportação do mesmo CSV). */
export async function hashFileContent(text: string): Promise<string> {
  return sha256Hex(text);
}
