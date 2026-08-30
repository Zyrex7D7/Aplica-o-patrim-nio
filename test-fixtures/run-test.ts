import { readFileSync } from "node:fs";
import { parseDegiroCsv } from "../src/lib/degiro/parser";

async function run(path: string) {
  const text = readFileSync(path, "utf-8");
  const result = await parseDegiroCsv(text);
  console.log(`\n=== ${path} ===`);
  console.log("Formato detetado:", result.format);
  console.log("Avisos:", result.warnings);
  for (const r of result.rows) {
    console.log({
      date: r.date,
      product: r.product,
      isin: r.isin,
      operation: r.operation,
      quantity: r.quantity,
      price: r.price,
      totalValue: r.totalValue,
      currency: r.currency,
      fees: r.fees,
      hash: r.sourceHash.slice(0, 12),
    });
  }
}

async function main() {
  await run("test-fixtures/degiro-transacoes.csv");
  await run("test-fixtures/degiro-conta.csv");

  // Verifica idempotência: correr o mesmo ficheiro duas vezes gera os mesmos hashes.
  const text = readFileSync("test-fixtures/degiro-transacoes.csv", "utf-8");
  const r1 = await parseDegiroCsv(text);
  const r2 = await parseDegiroCsv(text);
  const same = r1.rows.every((row, i) => row.sourceHash === r2.rows[i].sourceHash);
  console.log("\nHashes idênticos em re-parse (deduplicação):", same);
}

main();
