import { formatCurrency, formatPercent } from "@/lib/format";

export interface PositionRow {
  asset_id: string;
  name: string;
  symbol: string | null;
  isin: string | null;
  quantity_held: number;
  net_invested: number;
  total_dividends: number;
  currentPrice: number | null;
  marketValue: number;
}

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
    <div>
      <p className="sm:hidden text-xs text-text-faint mb-2">← Desliza para o lado para ver mais →</p>
      <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
        <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-text-faint border-b border-line">
            <th className="py-2 pr-4 font-medium">Ativo</th>
            <th className="py-2 pr-4 font-medium text-right">Qtd.</th>
            <th className="py-2 pr-4 font-medium text-right">Custo Médio</th>
            <th className="py-2 pr-4 font-medium text-right">Preço Atual</th>
            <th className="py-2 pr-4 font-medium text-right">Valor Atual</th>
            <th className="py-2 pr-4 font-medium text-right">Peso</th>
            <th className="py-2 pr-4 font-medium text-right">Lucro/Prejuízo</th>
            <th className="py-2 font-medium text-right">Dividendos</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const pnl = p.marketValue - p.net_invested;
            const pnlPct = p.net_invested !== 0 ? pnl / Math.abs(p.net_invested) : 0;
            const avgCost = p.quantity_held !== 0 ? p.net_invested / p.quantity_held : 0;
            const weight = totalValue > 0 ? p.marketValue / totalValue : 0;
            return (
              <tr key={p.asset_id} className="border-b border-line-soft last:border-0">
                <td className="py-2.5 pr-4">
                  <p className="text-text">{p.name}</p>
                  <p className="text-xs text-text-faint mt-0.5">{p.symbol ?? p.isin ?? "—"}</p>
                </td>
                <td className="py-2.5 pr-4 text-right tabular text-text-muted">
                  {p.quantity_held.toLocaleString("pt-PT", { maximumFractionDigits: 4 })}
                </td>
                <td className="py-2.5 pr-4 text-right tabular text-text-muted">
                  {formatCurrency(avgCost)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular text-text">
                  {p.currentPrice !== null ? formatCurrency(p.currentPrice) : "—"}
                </td>
                <td className="py-2.5 pr-4 text-right tabular text-text">
                  {formatCurrency(p.marketValue)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular text-text-muted">
                  {(weight * 100).toFixed(1)}%
                </td>
                <td
                  className={`py-2.5 pr-4 text-right tabular ${
                    pnl >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {formatCurrency(pnl)}
                  <span className="text-xs ml-1 opacity-70">({formatPercent(pnlPct)})</span>
                </td>
                <td className="py-2.5 text-right tabular text-text-muted">
                  {formatCurrency(p.total_dividends)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
