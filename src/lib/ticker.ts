/**
 * Ticker curto para mostrar na UI: "VWCE.DE" -> "VWCE", "AAPL" -> "AAPL".
 * Sem símbolo, usa a primeira palavra do nome (máx. 6 caracteres).
 */
export function shortTicker(symbol: string | null, name: string): string {
  if (symbol) return symbol.split(".")[0].toUpperCase();
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.slice(0, 6).toUpperCase();
}
