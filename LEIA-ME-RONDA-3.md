# Ronda 3 — Cotações alinhadas com a DEGIRO + interface mais simples

## Passo 1 — SQL
No SQL Editor da Supabase corre `supabase/005_cotacoes_eur.sql` (idempotente).

## Passo 2 — copia estes ficheiros (substituem por inteiro)
- `src/lib/market/quotes.ts`
- `src/app/api/quotes/route.ts`
- `src/lib/data/net-worth.ts`
- `src/app/dashboard/page.tsx`
- `src/components/portfolio/holdings-table.tsx`

Novos:
- `src/lib/ticker.ts`
- `src/components/dashboard/hero-card.tsx`
- `src/components/dashboard/top-movers.tsx`

## Passo 3 — 3 edições pequenas para guardar a bolsa da DEGIRO

### `src/lib/degiro/parser.ts`
1. Em `ParsedDegiroRow`, junta o campo:
```ts
  exchange: string | null;
```
2. Em `HEADER_ALIASES`, junta:
```ts
  exchange: ["bolsa de referencia", "bolsa de valores", "reference exchange"],
```
3. Dentro do ciclo `for`, logo a seguir a `const isin = ...`:
```ts
    const exchange = cols.exchange !== undefined ? raw[cols.exchange]?.trim() || null : null;
```
e no `rows.push({ ... })` junta `exchange,`.

### `src/app/api/degiro/import/route.ts`
1. No tipo de `uniqueAssets`, junta `exchange: string | null` e ao fazer
   `uniqueAssets.set(key, {...})` junta `exchange: row.exchange`.
2. No `.insert({ isin: asset.isin, name: asset.name, currency: asset.currency })`
   junta `exchange: asset.exchange`.
3. Depois de `assetIdByKey.set(key, existing.id); continue;` (ativo já existente),
   antes do `continue`, junta:
```ts
        if (asset.exchange) {
          await supabase.from("assets").update({ exchange: asset.exchange }).eq("id", existing.id).is("exchange", null);
        }
```

## Passo 4 — refazer a escolha dos símbolos
Os símbolos já resolvidos antes ficam como estão (podem ser da bolsa errada).
Depois de reimportares o CSV de **Transações** (é esse que traz a bolsa; o
"Estado de Conta" não traz), corre no SQL Editor:
```sql
update public.assets set symbol = null;
```
e carrega em "Atualizar cotações" no Portefólio. Os símbolos voltam a ser
escolhidos com a bolsa certa.

## Notas
- Os preços passam a ser convertidos para EUR (antes, ações em USD eram
  tratadas como se fossem EUR).
- A rota também falhava a gravar o símbolo descoberto (faltava a política
  UPDATE em `assets`) — corrigido no SQL.
- A variação "Hoje" usa o fecho anterior da mesma listagem.
