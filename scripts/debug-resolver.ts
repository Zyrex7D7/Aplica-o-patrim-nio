import { resolveSymbolFromIsin, getQuote } from "../src/lib/market/quotes";

async function main() {
  for (const isin of ["IE00B5BMR087", "IE00B4K48X80", "DE0007164600", "US67066G1040"]) {
    const r = await resolveSymbolFromIsin(isin);
    const q = r ? await getQuote(r.symbol) : null;
    console.log(isin, "->", r?.symbol, r?.exchange, q ? `${q.priceEur?.toFixed(2)} EUR` : "sem cotação");
  }
}
main();
