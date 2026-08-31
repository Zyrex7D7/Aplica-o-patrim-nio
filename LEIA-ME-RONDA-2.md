# Ronda 2 — Categorização automática + Comissões e Taxas

## Passo 1 — corre o SQL
No SQL Editor da Supabase, corre `supabase/004_regras_categorizacao_e_taxas.sql`
(depois de já teres corrido schema.sql, 002 e 003). É idempotente.

O que cria:
- Tabela `category_rules` (palavra-chave → categoria) + RLS.
- Função `suggest_category(user_id, descricao)` — devolve o `category_id`
  sugerido, se alguma regra tua bater com o texto.
- Coluna `categories.is_fee` — marca uma categoria como "comissão/taxa".
  A categoria por omissão "Comissões Bancárias" já fica marcada
  automaticamente pelo próprio script.
- Função `get_fees_summary(user_id, data_desde)` — soma comissões
  bancárias (categorias `is_fee = true`) + comissões de investimento
  (avulsas e embutidas nas transações da DEGIRO).
- Função `get_fee_transactions(user_id, data_desde)` — lista linha a
  linha de onde vêm essas comissões, para o detalhe expansível na UI.

## Passo 2 — copia os ficheiros
Mesma lógica da ronda anterior: substitui os ficheiros existentes,
adiciona os novos, tudo dentro de `src/`.

### Novo: Categorização automática
- `components/transactions/category-rules-manager.tsx` — em Movimentos,
  dentro do card "Categorias", secção "Categorização automática": cria
  regras tipo `"continente" → Supermercado`, `"netflix" → Subscrições`.
- `components/transactions/transaction-form.tsx` (substitui) — ao saíres
  do campo de descrição, chama `suggest_category` via RPC e pré-seleciona
  a categoria sugerida (continuas a poder mudá-la antes de guardar).
- `app/transacoes/actions.ts` (substitui) — `createCategoryRule` /
  `deleteCategoryRule`.
- `app/transacoes/page.tsx` (substitui) — busca as regras e passa-as ao
  gestor.

### Novo: Comissões e Taxas
- `components/reports/fees-summary.tsx` — cartões com Comissões
  Bancárias / Comissões de Investimento / Total, mais uma lista
  expansível linha a linha.
- `app/relatorios/page.tsx` (substitui) — novo card "Comissões e Taxas
  Pagas", respeitando o período selecionado no topo da página (1m/3m/
  6m/12m/Ano Atual).
- `components/transactions/category-manager.tsx` (substitui) — ao editar
  uma categoria, agora também dá para ligar "É uma comissão/taxa", com
  um selo vermelho "Taxa" na lista (para além do "Ajuste" já existente).
  Assim, se tiveres outra categoria tipo "Comissões de Manutenção de
  Conta" ou "Seguros Financeiros" que também queiras contar aqui, é só
  marcá-la.
- `app/transacoes/actions.ts` — `updateCategory` passa a gravar também
  `is_fee`.
- `types/database.ts` (substitui) — acrescenta `Category.is_fee`,
  `CategoryRule`, `FeesSummary`, `FeeTransactionRow`.

## Notas
- A sugestão automática só sugere — nunca cria nem edita a transação
  sozinha. Se escreveres uma descrição sem regra correspondente, o campo
  de categoria simplesmente fica como estava.
- As comissões de investimento já contavam para o `total_fees` por ativo
  no Portefólio; este card agrega isso com as comissões bancárias do
  orçamento, num só sítio, filtrado por período.
