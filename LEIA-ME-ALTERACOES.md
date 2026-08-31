# Alterações aplicadas

Copia estes ficheiros para o teu repositório, respeitando os mesmos
caminhos (todos dentro de `src/`). Ficheiros novos são criados; os que já
existiam no teu projeto ficam **substituídos por inteiro** — não é preciso
fazer merge manual, já contêm o código original + as alterações.

## UI/UX

- **Tabela do Portefólio no telemóvel** (`components/portfolio/holdings-table.tsx`)
  Abaixo de `md`, mostra cartões empilhados com os mesmos dados (peso, custo
  médio, P/L, retorno total, dividendos, data da 1ª compra) em vez da tabela
  com scroll horizontal. No desktop mantém-se a tabela igual a antes.

- **Ecrãs de loading** (`app/*/loading.tsx` + `components/ui/skeleton.tsx`)
  Adicionado `loading.tsx` a Dashboard, Contas, Movimentos, Relatórios,
  Portefólio e Recorrentes, com um esqueleto genérico (`<PageSkeleton />`).
  `/portfolio/importacoes` herda automaticamente o loading de `/portfolio`.

- **Páginas de erro** (`app/error.tsx`, `app/global-error.tsx`)
  `error.tsx` apanha falhas em qualquer rota (ex: Supabase em baixo) e
  mostra um ecrã com a tua identidade visual e um botão "Tentar novamente".
  `global-error.tsx` cobre o caso raro de o próprio `layout.tsx` falhar.

- **Gestão de categorias** (`components/transactions/category-manager.tsx`,
  integrado em `app/transacoes/page.tsx`)
  Novo bloco "Categorias" na página de Movimentos: expande para editar
  nome/cor de cada categoria e ligar/desligar "Excluir dos Relatórios"
  (o campo `exclude_from_reports` que já existia na base de dados mas não
  tinha interface), ou apagar a categoria (os movimentos ficam sem
  categoria, nunca são apagados).

## Funcionalidades

1. **Editar transações** — `components/transactions/edit-transaction-dialog.tsx`
   + `updateTransaction` em `app/transacoes/actions.ts`. Ícone de lápis em
   cada linha da lista de Movimentos, ao lado do de eliminar.

2. **Editar contas** — `components/accounts/edit-account-dialog.tsx` +
   `updateAccount` em `app/contas/actions.ts`. Permite corrigir nome, tipo
   e instituição (o saldo continua a não ser editável diretamente — é
   sempre derivado dos movimentos, por desenho da tua base de dados).

3. **Pesquisa/filtro em Movimentos** —
   `components/transactions/transaction-filters.tsx`, integrado na página
   via query string (`?q=...&account=...&category=...`). Com filtros
   ativos, o limite de 100 linhas sobe para 500 para a pesquisa não ficar
   escondida fora da primeira página.

4. **Exportar CSV nos Relatórios** — `components/reports/export-csv-button.tsx`.
   Gera o CSV inteiramente no browser (sem dependências novas), respeita o
   período selecionado, e usa `;` como separador + vírgula decimal, pronto
   a abrir no Excel em PT-PT.

5. **Histórico de importações** — `app/portfolio/importacoes/page.tsx`,
   com link a partir da página do Portefólio. Lista a tabela `csv_imports`
   que já existia, mostrando ficheiro, data, linhas inseridas/duplicadas/
   falhadas.

## O que fica de fora desta ronda

- **Categorização automática por regras** (`category_rules` /
  `suggest_category`): essas tabelas/funções **não existem** no
  `schema.sql` que me enviaste — não é só interface em falta, é preciso
  desenhar o esquema (tabela de regras, função de sugestão) antes de dar
  para construir a UI. Se quiseres, faço isso a seguir como próximo passo.

## Notas

- Nenhum SQL novo é necessário — tudo o que foi usado (`exclude_from_reports`,
  `csv_imports`) já existe no teu `schema.sql` / `003_correcoes_build.sql`.
- Não toquei em `package.json` — nenhuma destas alterações precisa de
  dependências novas.
