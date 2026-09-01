# Atualização: remover importação, comissões no portefólio, aba de orçamentos

## Ordem para aplicar

1. **Corre primeiro o SQL** no SQL Editor da Supabase:
   `supabase/004_remover_importacao.sql`

2. **Copia os ficheiros novos** para o teu projeto (mantendo os caminhos):
   - `src/app/portfolio/actions.ts`
   - `src/components/portfolio/undo-import-button.tsx`
   - `src/components/reports/reports-tabs.tsx`

3. **Substitui por inteiro** estes 3 ficheiros já existentes:
   - `src/app/api/degiro/import/route.ts`
   - `src/app/portfolio/page.tsx`
   - `src/app/relatorios/page.tsx`

4. **Ficheiro novo adicional**:
   - `src/components/portfolio/wipe-imports-button.tsx`
   (e `src/app/portfolio/actions.ts` já vem com a função `deleteAllImports`
   incluída — se já tinhas copiado a versão anterior, substitui-a por esta.)

## O que muda

- **Remover última importação**: botão em Portefólio → "Importar Extrato
  DEGIRO", ao lado do título. Apaga a importação DEGIRO mais recente e
  todas as transações que ela criou (via `import_id` com cascade na base
  de dados). Não reverte o `reconciled_balance` da conta automaticamente —
  só é substituído na próxima importação.

- **Comissões e Taxas Pagas**: novo quadrado (StatCard) na grelha do topo
  da página de Portefólio, ao lado de "Dividendos Recebidos".

- **Aba de Orçamentos**: a página de Relatórios passa a ter duas abas —
  "Visão Geral" (o que já lá estava) e "Orçamentos" (o formulário e a
  lista de orçamentos por categoria, que antes ficavam sempre visíveis no
  fundo da página).

- **Apagar tudo e recomeçar**: segundo botão, ao lado de "Remover última
  importação". Apaga TODAS as transações de bolsa e importações DEGIRO do
  utilizador, e limpa o ponto de reconciliação das contas afetadas (o
  saldo volta a ser calculado a partir do saldo inicial + movimentos de
  orçamento, como se nunca tivesse havido nenhuma importação). Pede para
  escreveres "APAGAR" antes de confirmar, porque é irreversível. Não apaga
  as contas nem o catálogo de ativos, só os dados de importação.

## Nota sobre o SQL "do projeto todo"

O `schema.sql` que partilhaste refere um `002_melhorias.sql` que não veio
incluído — é onde vivem `budgets`, `recurring_transactions`, a view
`budget_status` e a função `get_realized_pnl` (usadas na app, mas sem
definição disponível aqui). Não incluí essas peças no consolidado porque
`get_realized_pnl` faz cálculo de lucro realizado sobre dinheiro a sério, e
prefiro não adivinhar essa fórmula. Se encontrares esse ficheiro
(SQL Editor do Supabase → histórico, ou Database → Migrations), manda-mo
que junto tudo num script único.
