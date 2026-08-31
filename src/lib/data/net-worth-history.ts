import type { SupabaseClient } from "@supabase/supabase-js";
import type { NetWorthSnapshot } from "@/types/database";

/**
 * Garante que existe um snapshot de património para hoje (a função SQL faz
 * upsert, por isso é seguro chamar isto sempre que o dashboard carrega) e
 * devolve os últimos `days` dias de histórico para o gráfico de evolução.
 */
export async function getNetWorthHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  days = 90
): Promise<NetWorthSnapshot[]> {
  await supabase.rpc("capture_net_worth_snapshot", { p_user_id: userId });

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .eq("user_id", userId)
    .gte("snapshot_date", since.toISOString().slice(0, 10))
    .order("snapshot_date", { ascending: true });

  return data ?? [];
}
