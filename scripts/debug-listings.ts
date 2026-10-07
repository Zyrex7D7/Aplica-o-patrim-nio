import YahooFinance from "yahoo-finance2";
const y = new YahooFinance();
async function main() {
  for (const isin of ["IE00B5BMR087", "IE00B4K48X80", "DE0007164600"]) {
    const r = await y.search(isin, { quotesCount: 20 });
    console.log(isin);
    for (const q of r.quotes) {
      if ("symbol" in q) console.log("  ", q.symbol, (q as any).exchange, (q as any).quoteType);
    }
  }
}
main();
