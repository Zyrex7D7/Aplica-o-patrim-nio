import { formatCurrency, formatPercent, formatSignedCurrency, cx } from "@/lib/format";
import { shortTicker } from "@/lib/ticker";

export interface PositionRow {
  asset_id: string;
  name: string;
  symbol: string | null;
  isin: string | null;
  quantity_held: number;
  net_invested: number;
  total_dividends: number;
  total_fees: number;
  first_purchase_at: string | null;
  currentPrice: number | null;
  marketValue: number;
  dayChangePct?: number | null;
  dayChangeEur?: number | null;
}

function formatMonthYear(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-PT", { month: "short", year: "numeric" });
}

const tone = (v: number) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-text-muted");

/**
 * Um cartão por posição. Em cima: ticker, nome e valor atual. À direita, o
 * que interessa: retorno total (grande) e variação de hoje (pequena).
 * A barra lateral é verde ou vermelha conforme o retorno total.
 */
export function HoldingsTable({ positions }: { positions: PositionRow[] }) {
  if (positions.length === 0) {
    return (
      <p className="text-sm text-text-muted py-6 text-center">
        Ainda sem posições. Importa um extrato da DEGIRO acima.
      </p>
    );
  }

  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const sorted = [...positions].sort((a, b) => b.marketValue - a.marketValue);

  return (
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {sorted.map((p) => {
        const pnl = p.marketValue - p.net_invested;
        const totalReturn = pnl + p.total_dividends;
        const totalReturnPct = p.net_invested !== 0 ? totalReturn / Math.abs(p.net_invested) : 0;
        const avgCost = p.quantity_held !== 0 ? p.net_invested / p.quantity_held : 0;
        const weight = totalValue > 0 ? p.marketValue / totalValue : 0;
        const up = totalReturn >= 0;

        return (
          <li
            key={p.asset_id}
            className={cx(
              "rounded-xl border border-line bg-surface p-4 border-l-4",
              up ? "border-l-gain" : "border-l-loss"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-text">{shortTicker(p.symbol, p.name)}</p>
                <p className="text-xs text-text-faint truncate">{p.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="tabular text-base text-text">{formatCurrency(p.marketValue)}</p>
                <p className={cx("tabular text-sm", tone(totalReturn))}>{formatPercent(totalReturnPct)}</p>
              </div>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-xs text-text-faint tabular">
                {p.currentPrice !== null ? `${formatCurrency(p.currentPrice)} · ` : ""}
                {p.quantity_held.toLocaleString("pt-PT", { maximumFractionDigits: 4 })} un.
              </p>
              {p.dayChangePct != null && p.dayChangeEur != null ? (
                <p className={cx("tabular text-xs", tone(p.dayChangeEur))}>
                  Hoje {formatPercent(p.dayChangePct)} · {formatSignedCurrency(p.dayChangeEur)}
                </p>
              ) : (
                <p className="text-xs text-text-faint">Sem cotação</p>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-line-soft grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-text-faint">Custo médio</p>
                <p className="tabular text-text-muted">{formatCurrency(avgCost)}</p>
              </div>
              <div>
                <p className="text-text-faint">Lucro</p>
                <p className={cx("tabular", tone(totalReturn))}>{formatSignedCurrency(totalReturn)}</p>
              </div>
              <div className="text-right">
                <p className="text-text-faint">Peso · desde</p>
                <p className="tabular text-text-muted">
                  {(weight * 100).toFixed(1)}% · {formatMonthYear(p.first_purchase_at)}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
