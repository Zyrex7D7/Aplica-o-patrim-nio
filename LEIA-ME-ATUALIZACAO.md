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
