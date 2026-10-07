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
 * 1. Faz parse do CSV no servidor.
 * 2. Identifica cada ativo pelo ISIN (e pela bolsa da DEGIRO, quando o CSV a traz).
 * 3. Converte para EUR os valores em moeda estrangeira (ex: ações em USD), usando
 *    o câmbio do próprio CSV ou, na falta dele, o câmbio histórico do dia.
 * 4. Cria a linha em csv_imports ANTES das transações (a foreign key exige).
 * 5. Insere as transações (ignora duplicados) e reconcilia o saldo da conta.
 * 6. Atualiza automaticamente as cotações de todos os ativos.
 */

/** Lê a bolsa de referência da DEGIRO a partir da linha crua do CSV, se existir. */
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
  if (!csvText || !fileName || !accountId) {
    return NextResponse.json(
      { error: "Faltam campos obrigatórios: csvText, fileName, accountId." },
      { status: 400 }
    );
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

  // --- 1. Ativos (por ISIN; fallback pelo nome do produto) ----------------
  const assetIdByKey = new Map<string, string>();
  const uniqueAssets = new Map<
    string,
    { isin: string | null; name: string; currency: string; exchange: string | null }
  >();
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
      const { data: fallback } = await supabase
        .from("assets")
        .select("id")
        .eq("isin", asset.isin ?? "")
        .maybeSingle();
      if (fallback) assetIdByKey.set(key, fallback.id);
      continue;
    }
    assetIdByKey.set(key, inserted.id);
  }

  // --- 2. Conversão para EUR de valores em moeda estrangeira --------------
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

    warnings.push(`Sem câmbio para converter ${currency} em ${date}; valor mantido sem conversão.`);
    return amount;
  }

  const rowsToInsert = [];
  for (const row of parsed.rows) {
    const key = row.isin ?? `name:${row.product}`;
    const totalEur = await amountToEur(row.totalValue, row.currency, row.exchangeRate, row.date);
    rowsToInsert.push({
      user_id: userId,
      account_id: accountId,
      asset_id: assetIdByKey.get(key)!,
      operation: row.operation,
      occurred_on: row.date,
      occurred_at: row.datetime,
      quantity: row.quantity,
      price: row.price,
      local_value: row.localValue,
      fees: row.fees,
      total_value: totalEur, // sempre em EUR
      currency: row.currency, // moeda original da operação
      exchange_rate: row.exchangeRate,
      description: row.description,
      order_id: row.orderId,
      source_hash: row.sourceHash,
      source: "degiro",
      raw_row: row.raw,
    });
  }

  // --- 3. Importação PRIMEIRO (a FK exige), depois as transações ----------
  const { data: importRow, error: importInsertError } = await supabase
    .from("csv_imports")
    .insert({
      user_id: userId,
      account_id: accountId,
      file_name: fileName,
      file_hash: fileHash,
      rows_total: parsed.rows.length,
      rows_inserted: 0,
      rows_duplicated: 0,
      rows_failed: parsed.skipped,
    })
    .select("id")
    .single();

  if (importInsertError || !importRow) {
    return NextResponse.json(
      { error: importInsertError?.message ?? "Falha ao registar a importação." },
      { status: 500 }
    );
  }

  const importId = importRow.id;
  const withImport = rowsToInsert.map((r) => ({ ...r, import_id: importId }));

  const { data: insertedRows, error: insertError } = await supabase
    .from("asset_transactions")
    .upsert(withImport, { onConflict: "user_id,source_hash", ignoreDuplicates: true })
    .select("id");

  if (insertError) {
    await supabase.from("csv_imports").delete().eq("id", importId);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const rowsInserted = insertedRows?.length ?? 0;
  const rowsDuplicated = withImport.length - rowsInserted;

  await supabase
    .from("csv_imports")
    .update({ rows_inserted: rowsInserted, rows_duplicated: rowsDuplicated })
    .eq("id", importId);

  // --- 4. Reconcilia o saldo livre com o "Saldo" reportado pela DEGIRO ----
  let reconciledBalance: { balance: number; at: string } | null = null;
  if (parsed.latestBalance) {
    const { error: reconcileError } = await supabase.rpc("reconcile_account_balance", {
      p_account_id: accountId,
      p_balance: parsed.latestBalance.balance,
      p_at: parsed.latestBalance.occurredAt,
    });
    if (reconcileError) {
      console.error("Falha ao reconciliar saldo da conta:", reconcileError.message);
    } else {
      reconciledBalance = { balance: parsed.latestBalance.balance, at: parsed.latestBalance.occurredAt };
    }
  }

  // --- 5. Atualiza as cotações automaticamente ----------------------------
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
    reconciledBalance,
    quotesUpdated: quotes.updated,
  });
}
