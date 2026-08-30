import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashFileContent, parseDegiroCsv } from "@/lib/degiro/parser";

/**
 * POST /api/degiro/import
 * Body: { csvText: string, fileName: string, accountId: string }
 *
 * 1. Faz parse do CSV no servidor (fonte de verdade — nunca confiar apenas
 *    no parsing feito no browser).
 * 2. Garante que cada ISIN/produto tem uma linha correspondente em `assets`.
 * 3. Insere as `asset_transactions`, ignorando duplicados através da
 *    restrição única (user_id, source_hash).
 * 4. Regista um resumo em `csv_imports` para auditoria/histórico.
 */
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

  // Deteta re-upload do mesmo ficheiro exato antes de fazer qualquer trabalho.
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

  // --- 1. Upsert de ativos (por ISIN; fallback pelo nome do produto) ------
  const assetIdByKey = new Map<string, string>();
  const uniqueAssets = new Map<string, { isin: string | null; name: string; currency: string }>();
  for (const row of parsed.rows) {
    const key = row.isin ?? `name:${row.product}`;
    if (!uniqueAssets.has(key)) {
      uniqueAssets.set(key, { isin: row.isin, name: row.product, currency: row.currency });
    }
  }

  for (const [key, asset] of uniqueAssets) {
    if (asset.isin) {
      const { data: existing } = await supabase
        .from("assets")
        .select("id")
        .eq("isin", asset.isin)
        .maybeSingle();

      if (existing) {
        assetIdByKey.set(key, existing.id);
        continue;
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("assets")
      .insert({ isin: asset.isin, name: asset.name, currency: asset.currency })
      .select("id")
      .single();

    if (insertErr) {
      // corrida entre pedidos concorrentes ou ISIN já existe -> tenta ler de novo
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

  // --- 2. Inserção das transações (ignora duplicados pelo source_hash) ---
  const rowsToInsert = parsed.rows.map((row) => {
    const key = row.isin ?? `name:${row.product}`;
    return {
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
      total_value: row.totalValue,
      currency: row.currency,
      exchange_rate: row.exchangeRate,
      description: row.description,
      order_id: row.orderId,
      source_hash: row.sourceHash,
      source: "degiro",
      raw_row: row.raw,
    };
  });

  const { data: insertedRows, error: insertError } = await supabase
    .from("asset_transactions")
    .upsert(rowsToInsert, { onConflict: "user_id,source_hash", ignoreDuplicates: true })
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const rowsInserted = insertedRows?.length ?? 0;
  const rowsDuplicated = rowsToInsert.length - rowsInserted;

  await supabase.from("csv_imports").insert({
    user_id: userId,
    account_id: accountId,
    file_name: fileName,
    file_hash: fileHash,
    rows_total: parsed.rows.length,
    rows_inserted: rowsInserted,
    rows_duplicated: rowsDuplicated,
    rows_failed: parsed.skipped,
  });

  // --- 3. Reconcilia o saldo da conta com o valor que a própria DEGIRO
  //         reportou (coluna "Saldo") na linha mais recente do ficheiro.
  //         Isto garante que depósitos, levantamentos, cash sweeps e juros
  //         — que não modelamos individualmente — continuam refletidos no
  //         saldo livre da conta, sem termos de os tratar um a um.
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

  return NextResponse.json({
    alreadyImported: false,
    format: parsed.format,
    rowsTotal: parsed.rows.length,
    rowsInserted,
    rowsDuplicated,
    rowsSkipped: parsed.skipped,
    warnings: parsed.warnings,
    reconciledBalance,
  });
}
