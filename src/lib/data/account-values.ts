import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnrichedPosition } from "@/lib/data/net-worth";

/**
 * Valor das ações/ETFs que cada conta de corretora tem (unidades em cada conta × valor atual
 * por unidade). Serve para mostrar, na lista de Contas, o TOTAL da corretora: investido + saldo livre.
 */
export async function getInvestedByAccount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  brokerAccountIds: string[],
  positions: EnrichedPosition[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (brokerAccountIds.length === 0 || positions.length === 0) return result;

  const { data: txs } = await supabase
    .from("asset_transactions")
    .select("account_id, asset_id, operation, quantity")
    .eq("user_id", userId)
    .in("account_id", brokerAccountIds)
    .in("operation", ["compra", "venda"]);

  const unitValue = new Map<string, number>(
    positions.filter((p) => p.quantity_held > 0).map((p) => [p.asset_id, p.marketValue / p.quantity_held])
  );

  // unidades por (conta, ativo)
  const qty = new Map<string, number>();
  for (const t of (txs ?? []) as { account_id: string; asset_id: string; operation: string; quantity: number | null }[]) {
    const key = `${t.account_id}|${t.asset_id}`;
    const q = Number(t.quantity ?? 0) * (t.operation === "compra" ? 1 : -1);
    qty.set(key, (qty.get(key) ?? 0) + q);
  }

  for (const [key, q] of qty) {
    if (q <= 0.0000001) continue;
    const [accountId, assetId] = key.split("|");
    const unit = unitValue.get(assetId);
    if (unit === undefined) continue;
    result.set(accountId, (result.get(accountId) ?? 0) + q * unit);
  }
  return result;
}
