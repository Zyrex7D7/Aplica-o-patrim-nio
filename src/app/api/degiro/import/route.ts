import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashFileContent, parseDegiroCsv } from "@/lib/degiro/parser";
import { getHistoricalFxToEur } from "@/lib/market/quotes";
import { refreshQuotes } from "@/lib/market/refresh";

export const maxDuration = 60;

/**
 * POST /api/degiro/import
 * Body: { csvText: string, fileName: string, accountId: string }
 *
 * 1. Parse do CSV no servidor.
 * 2. Converte para EUR os valores em moeda estrangeira (câmbio do CSV ou histórico do dia).
 *    Se o câmbio não estiver disponível, ABORTA sem gravar nada (nunca grava dólares como euros).
 * 3. Garante os ativos (por ISIN) e a bolsa de referência da DEGIRO.
 * 4. Grava importação + transações + saldo reconciliado NUMA SÓ TRANSAÇÃO (RPC import_asset_transactions).
 * 5. Atualiza as cotações automaticamente.
 */

class FxUnavailableError extends Error {}

function exchangeFromRaw(raw: Record<string, string>): string | null {
  const names = ["bolsa de referencia", "reference exchange", "bolsa de valores"];
  for (const [header, value] of Object.entries(raw)) {
    const h = header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (names.includes(h)) {
      const v = (value ?? "").trim();
      if (v) return v;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { csvText, fileName, accountId } = body ?? {};
  if (
    typeof csvText !== "string" || !csvText ||
    typeof fileName !== "string" || !fileName ||
    typeof accountId !== "string" || !accountId
  ) {
    return NextResponse.json({ error: "Faltam campos obrigatórios: csvText, fileName, accountId." }, { status: 400 });
  }

  const userId = auth.user.id;
  const fileHash = await hashFileContent(csvText);

  const { data: existingImport } = await supabase
    .from("csv_imports")
    .select("id, created_at, rows_inserted")
    .eq("user_id", userId)
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (existingImport) {
    return NextResponse.json({
      alreadyImported: true,
      message: `Este ficheiro já foi importado em ${new Date(existingImport.created_at).toLocaleString("pt-PT")}.`,
      previousImport: existingImport,
    });
  }

  const parsed = await parseDegiroCsv(csvText);
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: "Não foi possível extrair nenhuma transação válida do ficheiro.", warnings: parsed.warnings },
      { status: 422 }
    );
  }

  const warnings = [...parsed.warnings];

  // --- 1. Conversão para EUR (antes de gravar seja o que for) -------------
  const histCache = new Map<string, number | null>();
  async function histFx(currency: string, date: string): Promise<number | null> {
    const key = `${currency}|${date}`;
    if (!histCache.has(key)) histCache.set(key, await getHistoricalFxToEur(currency, date));
    return histCache.get(key) ?? null;
  }

  /** O câmbio do CSV vem na convenção da DEGIRO (moeda por 1 EUR) ou invertido; o histórico decide. */
  async function amountToEur(amount: number, currency: string, csvRate: number | null, date: string): Promise<number> {
    if (!currency || currency === "EUR" || amount === 0) return amount;
    const hist = await histFx(currency, date); // EUR por 1 unidade da moeda

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

  const converted: number[] = [];
  try {
    for (const row of parsed.rows) {
      converted.push(await amountToEur(row.totalValue, row.currency, row.exchangeRate, row.date));
    }
  } catch (err) {
    if (err instanceof FxUnavailableError) {
      return NextResponse.json(
        { error: `${err.message} O Yahoo Finance pode estar indisponível — tenta novamente dentro de uns minutos. Nada foi gravado.` },
        { status: 503 }
      );
    }
    throw err;
  }

  // --- 2. Ativos (por ISIN; fallback pelo nome) ----------------------------
  const assetIdByKey = new Map<string, string>();
  const uniqueAssets = new Map<string, { isin: string | null; name: string; currency: string; exchange: string | null }>();
  for (const row of parsed.rows) {
    const key = row.isin ?? `name:${row.product}`;
    const exchange = exchangeFromRaw(row.raw);
    const existing = uniqueAssets.get(key);
    if (!existing) {
      uniqueAssets.set(key, { isin: row.isin, name: row.product, currency: row.currency, exchange });
    } else if (!existing.exchange && exchange) {
      existing.exchange = exchange;
    }
  }

  for (const [key, asset] of uniqueAssets) {
    if (asset.isin) {
      const { data: existing } = await supabase.from("assets").select("id").eq("isin", asset.isin).maybeSingle();
      if (existing) {
        assetIdByKey.set(key, existing.id);
        if (asset.exchange) {
          await supabase.from("assets").update({ exchange: asset.exchange }).eq("id", existing.id);
        }
        continue;
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("assets")
      .insert({ isin: asset.isin, name: asset.name, currency: asset.currency, exchange: asset.exchange })
      .select("id")
      .single();

    if (insertErr) {
      const { data: fallback } = await supabase.from("assets").select("id").eq("isin", asset.isin ?? "").maybeSingle();
      if (fallback) assetIdByKey.set(key, fallback.id);
      continue;
    }
    assetIdByKey.set(key, inserted.id);
  }

  const missing = [...uniqueAssets.entries()].filter(([key]) => !assetIdByKey.has(key)).map(([, a]) => a.name);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Não foi possível registar o(s) ativo(s): ${missing.join(", ")}. Nada foi gravado.` },
      { status: 500 }
    );
  }

  // --- 3. Importação atómica ----------------------------------------------
  const payload = parsed.rows.map((row, i) => ({
    asset_id: assetIdByKey.get(row.isin ?? `name:${row.product}`),
    operation: row.operation,
    occurred_on: row.date,
    occurred_at: row.datetime,
    quantity: row.quantity,
    price: row.price,
    local_value: row.localValue,
    fees: row.fees,
    total_value: converted[i], // sempre em EUR
    currency: row.currency, // moeda original da operação
    exchange_rate: row.exchangeRate,
    description: row.description,
    order_id: row.orderId,
    source_hash: row.sourceHash,
    raw_row: row.raw,
  }));

  const { data: result, error: rpcError } = await supabase.rpc("import_asset_transactions", {
    p_account_id: accountId,
    p_file_name: fileName,
    p_file_hash: fileHash,
    p_rows_failed: parsed.skipped,
    p_rows: payload,
    p_balance: parsed.latestBalance?.balance ?? null,
    p_balance_at: parsed.latestBalance?.occurredAt ?? null,
  });

  if (rpcError) {
    if (rpcError.code === "23505") {
      // importado em simultâneo por outro pedido
      return NextResponse.json({ alreadyImported: true, message: "Este ficheiro já foi importado." });
    }
    return NextResponse.json({ error: rpcError.message }, { status: rpcError.code === "42501" ? 403 : 500 });
  }

  const rowsInserted: number = result?.rows_inserted ?? 0;
  const rowsDuplicated: number = result?.rows_duplicated ?? 0;

  // --- 4. Cotações automáticas --------------------------------------------
  const quotes = await refreshQuotes(supabase, userId);
  if (quotes.failed > 0) {
    warnings.push(`${quotes.failed} ativo(s) sem cotação — carrega em "Atualizar cotações" para tentar de novo.`);
  }

  return NextResponse.json({
    alreadyImported: false,
    format: parsed.format,
    rowsTotal: parsed.rows.length,
    rowsInserted,
    rowsDuplicated,
    rowsSkipped: parsed.skipped,
    warnings,
    reconciledBalance: parsed.latestBalance
      ? { balance: parsed.latestBalance.balance, at: parsed.latestBalance.occurredAt }
      : null,
    quotesUpdated: quotes.updated,
  });
}
