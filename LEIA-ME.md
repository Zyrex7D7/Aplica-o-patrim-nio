# Corrigir o deploy que falhou

O `npm run build` corre o `tsc` a sério (o `npm run dev` não) — apanhou 2
sítios onde o front-end já esperava campos que a base de dados e os tipos
ainda não tinham. Não é nada partido pelo que te mandei antes; é código teu
(ou de outra sessão) que ficou um passo à frente do schema.

## 1. Corre o SQL

No SQL Editor da Supabase, corre `003_correcoes_build.sql` (depois do
`schema.sql` e do `002_melhorias.sql`, se ainda não os tiveres corrido).

Isto acrescenta:
- `categories.exclude_from_reports` (boolean, default `false`) — para a
  badge "Ajuste" que já tens em `transaction-list.tsx`.
- `total_fees` e `first_purchase_at` na view `portfolio_positions` — para as
  colunas que já tens em `holdings-table.tsx`.

## 2. Substitui o ficheiro de tipos

`src/types/database.ts` — vem com os campos novos adicionados aos tipos
`Category` e `PortfolioPosition` (mais tudo o que já lá estava dos packs
anteriores). Isto sozinho já resolve os 3 erros do build.

## 3. Volta a fazer deploy

```bash
npm run build
```

localmente primeiro para confirmares que compila, depois `git push` /
redeploy no Vercel.

## Nota — a badge "Ajuste" nunca vai aparecer ainda

Adicionei a coluna `exclude_from_reports`, mas não existe nenhum sítio na UI
para a ligares numa categoria (não vi um formulário de edição de categorias
no que me mandaste — só o "Nova categoria" rápido em `category-quick-add.tsx`).
Por agora todas as categorias ficam com `exclude_from_reports = false` por
omissão, por isso o build passa e nada muda visualmente. Se quiseres, faço a
seguir um pequeno toggle na listagem/edição de categorias para conseguires
marcar isso.
