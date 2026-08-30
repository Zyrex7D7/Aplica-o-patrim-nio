# Livro — Gestor de Património e Finanças Pessoais

Aplicação web completa de gestão de património e orçamento pessoal, com
importação automática de extratos da DEGIRO e cotações em tempo real.

## Stack Tecnológica

| Camada | Escolha | Porquê |
|---|---|---|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions) | Renderização no servidor para dados financeiros sensíveis, rotas de API integradas para o parser e as cotações, e Server Actions eliminam a necessidade de uma camada REST separada. |
| Linguagem | **TypeScript** | Segurança de tipos ponta a ponta entre o schema Supabase e a UI. |
| Base de Dados | **Supabase** (Postgres + Auth + Row Level Security) | Pedido explícito. Usa-se Postgres puro com views e triggers para manter os saldos das contas sempre consistentes, e RLS para isolar os dados de cada utilizador. |
| Estilos | **Tailwind CSS v4** | Utilitários modernos, tema "Livro-Razão" (ledger) definido em `globals.css`. |
| Gráficos | **Recharts** | Gráfico de distribuição do património (donut) e de despesas por categoria (barras). |
| Parsing CSV | **PapaParse** | Parser CSV robusto, usado como base para o parser específico da DEGIRO. |
| Cotações | **yahoo-finance2 (v4)** | Resolve o símbolo Yahoo Finance a partir do ISIN e obtém o preço atual. |
| Autenticação | **Supabase Auth (email + palavra-passe)** | Sem registo público — as contas são criadas pelo administrador com um script CLI, usando a Service Role Key. Login simples por email/password, sem depender de emails de convite. |

## Estrutura do Projeto

```
src/
├── app/
│   ├── dashboard/        # Património Global (Net Worth)
│   ├── contas/           # CRUD de Contas (banco/corretora/numerário)
│   ├── transacoes/       # Receitas, despesas e transferências
│   ├── relatorios/       # Filtros de período + despesas por categoria
│   ├── portfolio/        # Upload do CSV DEGIRO + posições
│   ├── login/            # Autenticação (email + palavra-passe)
│   └── api/
│       ├── degiro/import/  # Parsing + inserção das transações DEGIRO
│       └── quotes/         # Atualização das cotações via Yahoo Finance
├── components/           # Componentes de UI organizados por domínio
├── lib/
│   ├── degiro/           # Parser CSV DEGIRO (formato europeu, deduplicação)
│   ├── market/           # Integração com yahoo-finance2
│   ├── data/             # Agregação de dados para o dashboard (net worth)
│   └── supabase/         # Clientes Supabase (browser + servidor)
├── types/database.ts     # Tipos TS que espelham o schema SQL
└── proxy.ts              # Proteção de rotas (equivalente ao antigo middleware)

scripts/
├── create-user.ts        # CLI de administração: cria utilizadores (email+password)
└── list-users.ts         # CLI de administração: lista utilizadores existentes

supabase/schema.sql        # Esquema completo (tabelas, views, triggers, RLS)
test-fixtures/             # CSVs de exemplo + script para testar o parser
```

## Como Correr Localmente

### 1. Cria um projeto Supabase
Vai a [supabase.com](https://supabase.com), cria um projeto novo e copia o
`Project URL` e a `anon public key` (Project Settings → API).

### 2. Aplica o esquema SQL
No **SQL Editor** do Supabase, corre o conteúdo de `supabase/schema.sql`
(é idempotente — podes correr várias vezes em segurança). Isto cria:
- Tabelas: `accounts`, `categories`, `transactions`, `assets`,
  `asset_transactions`, `asset_quotes`, `csv_imports`.
- Views: `account_balances` (saldo corrente derivado), `portfolio_positions`
  (posições agregadas por ativo).
- Triggers que recalculam automaticamente `accounts.current_balance` sempre
  que uma transação de orçamento ou de bolsa é inserida/alterada/apagada.
- Row Level Security: cada utilizador só vê os seus próprios dados.
- Função `seed_default_categories(user_id)`, chamada automaticamente pelo
  script `create-user` para criar categorias por omissão (Salário, Alimentação,
  Transportes, etc.) assim que a conta é criada.

### 3. Configura as variáveis de ambiente
```bash
cp .env.local.example .env.local
```
Edita `.env.local` e preenche:
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
- `SUPABASE_SERVICE_ROLE_KEY` (a chave secreta, também em Project Settings → API,
  chamada `service_role`) — **só é usada pelos scripts de administração abaixo,
  nunca pela aplicação em si nem exposta ao browser.**

### 4. Cria o teu utilizador
Não há registo público (sem formulário de "criar conta" nem emails de
convite). As contas são criadas diretamente por ti, o administrador:

```bash
npm run create-user -- --email tu@exemplo.com --password "umaPasswordForte123"
```

Isto cria a conta já confirmada (sem precisar de clicar em nenhum email) e
prepara logo as categorias por omissão. Para veres as contas já criadas:

```bash
npm run list-users
```

### 5. Instala e corre
```bash
npm install
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) e entra com o email e a
palavra-passe que definiste no passo anterior.

### Testar apenas o parser DEGIRO (sem Supabase)
```bash
npx tsx test-fixtures/run-test.ts
```

## Funcionalidades

### 1. Dashboard de Património Global
Soma em tempo real: saldo em contas bancárias + saldo livre em corretoras +
numerário + valor atual do portefólio (via cotações Yahoo Finance). Inclui
gráfico de distribuição (donut) e resumo de custo vs. valor atual do
portefólio.

### 2. Gestão de Contas
CRUD simples de contas (Banco / Corretora / Numerário). O saldo apresentado
(`current_balance`) é recalculado automaticamente por triggers Postgres
sempre que há um movimento de orçamento ou uma transação de bolsa associada
à conta — nunca precisas de o atualizar manualmente.

### 3. Orçamento (Receitas e Despesas)
Formulário com Tipo (Receita / Despesa / Transferência), Valor, Data, Conta,
Categoria personalizável e Descrição livre. Podes criar categorias novas
diretamente no formulário.

### 4. Relatórios
Filtros rápidos de período (1/3/6/12 meses, Ano Atual) via query string
(`?period=3m`), com gráfico de barras da distribuição de despesas por
categoria e tabela de detalhe com percentagens.

### 5. Portefólio + Parser DEGIRO
- **Deteção automática de formato:** reconhece tanto o export
  "Transações" (com Quantidade/Preço explícitos) como o "Estado de Conta"
  (extrato de caixa, onde a operação é inferida do texto da Descrição).
- **Formato europeu:** trata números `1.234,56`, datas `dd-mm-aaaa`, e
  delimitador `;` ou `,` consoante o locale do export.
- **Classificação da operação:** Compra, Venda, Dividendo, Comissão —
  por palavras-chave multi-idioma (PT/EN/ES) na coluna Descrição/Mutação.
- **Deduplicação:** cada linha gera um hash SHA-256 estável
  (`source_hash`), com uma constraint única `(user_id, source_hash)` na
  base de dados — re-carregar o mesmo ficheiro nunca duplica transações.
  O hash do ficheiro inteiro também é guardado em `csv_imports` para
  detetar re-uploads completos antes de reprocessar.
- **Cotações em tempo real:** botão "Atualizar cotações" resolve o
  símbolo Yahoo Finance a partir do ISIN (na primeira vez) e atualiza o
  cache `asset_quotes`, usado para calcular o valor atual e o
  Lucro/Prejuízo de cada posição.

## Gestão de Utilizadores

Esta aplicação **não tem registo público**. Só o administrador (quem tem
acesso ao `.env.local` com a `SUPABASE_SERVICE_ROLE_KEY`) pode criar contas:

```bash
# Criar um novo utilizador (fica logo ativo, sem email de confirmação)
npm run create-user -- --email familiar@exemplo.com --password "outraPasswordForte"

# Ver todos os utilizadores existentes
npm run list-users
```

Para revogar acesso ou repor a palavra-passe de alguém, usa o dashboard do
Supabase em **Authentication → Users** (podes eliminar o utilizador ou
enviar um link de reposição de password a partir daí, se preferires).

## Notas de Produção

- O middleware de autenticação está em `src/proxy.ts` (renomeado de
  `middleware.ts` — convenção alterada no Next.js 16).
- As chamadas ao Yahoo Finance não têm chave de API, mas não têm SLA
  garantido; para uso intensivo, considera um cache mais agressivo ou uma
  API de cotações paga.
- A `SUPABASE_SERVICE_ROLE_KEY` só é usada pelos scripts `create-user` e
  `list-users`, correndo no teu computador — a aplicação em si (páginas,
  Server Actions, rotas de API) usa sempre a `anon key` e depende da
  sessão do utilizador autenticado, com toda a segurança garantida pela
  Row Level Security.
