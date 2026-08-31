# Como aplicar este pack (Fase 2: histórico, recorrências, orçamentos, P&L realizado)

## 1. Pré-requisito: corre o SQL

Se ainda não correste o `002_melhorias.sql` que te mandei antes, corre-o agora no
SQL Editor da Supabase — este pack depende das tabelas/funções/views que ele cria
(`net_worth_snapshots`, `recurring_transactions`, `budgets`, `budget_status`,
`get_realized_pnl`, etc).

## 2. Copia os ficheiros

Caminhos relativos à raiz do projeto.

| Ficheiro | Estado |
|---|---|
| `src/types/database.ts` | substituir |
| `src/lib/data/net-worth-history.ts` | novo |
| `src/components/dashboard/net-worth-history-chart.tsx` | novo |
| `src/app/dashboard/page.tsx` | substituir |
| `src/app/recorrentes/actions.ts` | novo |
| `src/app/recorrentes/page.tsx` | novo |
| `src/components/recurring/recurring-form.tsx` | novo |
| `src/components/recurring/recurring-list.tsx` | novo |
| `src/components/nav-sidebar.tsx` | substituir (adiciona "Recorrências" ao menu) |
| `src/app/transacoes/page.tsx` | substituir (aplica recorrências vencidas + link) |
| `src/app/relatorios/actions.ts` | novo |
| `src/app/relatorios/page.tsx` | substituir (adiciona secção de Orçamentos) |
| `src/components/reports/budget-form.tsx` | novo |
| `src/components/reports/budget-list.tsx` | novo |
| `src/app/portfolio/page.tsx` | substituir (adiciona Lucro Realizado) |

Nota: `src/types/database.ts` já vem com os campos todos do pack anterior — não
precisas de reaplicar o de antes por cima, este já inclui tudo.

## 3. O que ficou por fazer (a propósito, não por esquecimento)

- **Categorização automática por regras** (`category_rules` / `suggest_category`):
  a tabela e a função já existem no SQL, mas não construí a UI (ex: sugestão
  automática de categoria à medida que escreves a descrição num movimento).
  Diz se queres que avance com isso a seguir.
- Não adicionei "Recorrências" à barra de navegação do telemóvel (fica só no
  menu lateral do desktop) para não sobrecarregar a barra de 5 ícones — no
  telemóvel acede-se pelo link "Ver recorrências" no topo da página de
  Movimentos.
- A tabela de posições do portefólio continua sem versão em cartões para
  mobile (mencionado na resposta anterior) — ainda não pedida explicitamente.

## 4. Testa

```bash
npm run dev
```

- Abre o Dashboard — deve aparecer "Evolução do Património" (com "ainda não há
  histórico" no primeiro dia; volta amanhã para veres um segundo ponto).
- Cria uma recorrência em `/recorrentes` com data de início no passado — ao
  recarregar `/transacoes` ou `/recorrentes`, o movimento deve aparecer criado
  automaticamente.
- Em `/relatorios`, define um orçamento para uma categoria de despesa e
  confirma que a barra de progresso reflete os movimentos já registados.
- Em `/portfolio`, confirma que "Lucro Realizado" aparece (fica a 0,00 € se
  nunca tiveres vendido nada).
