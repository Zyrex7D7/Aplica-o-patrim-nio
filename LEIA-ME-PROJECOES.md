# Dinheiro Total nas Corretoras + Aba de Projeções

## Como aplicar

Copia estes ficheiros para o teu projeto, respeitando os mesmos caminhos
(todos dentro de `src/`). Ficheiros novos são criados; `src/app/portfolio/page.tsx`
já existia e fica **substituído por inteiro**.

```
src/
├── lib/
│   └── reports/
│       └── projections.ts                       novo
├── components/
│   └── portfolio/
│       ├── portfolio-projections.tsx             novo
│       └── portfolio-tabs.tsx                    novo
└── app/
    └── portfolio/
        └── page.tsx                              substituir
```

Não é preciso correr nenhum SQL novo — tudo usa dados que já tens
(`net_worth_snapshots`, `portfolio_positions`, etc.).

## O que muda

### 1. Dinheiro Total nas Corretoras
Logo abaixo do cabeçalho da página de Portefólio, um número grande em
destaque (estilo igual ao total do Dashboard) com a soma de:
- Valor atual de todas as ações que tens (`breakdown.portfolioValue`)
- Saldo livre em todas as contas do tipo "Corretora" que ainda não
  investiste (`freeCash`)

### 2. Aba "Projeções"
A página de Portefólio passa a ter duas abas — "Visão Geral" (o que já lá
estava: composição, desempenho, posições) e "Projeções" (novo).

Na aba de Projeções:
- **3 cenários** — Conservador, Moderado e Otimista, com uma taxa de
  retorno anual moderada como ponto de partida e ±3 pontos percentuais
  para os outros dois.
- **Taxa sugerida automaticamente**, calculada a partir do teu histórico
  real em `net_worth_snapshots.portfolio_value` (a mesma tabela que já
  alimenta o gráfico de "Evolução do Património" no Dashboard). Se ainda
  não tiveres pelo menos ~2 semanas de histórico, usa-se uma taxa de
  referência de 7%/ano (média histórica genérica do mercado de ações).
- **Podes ajustar tudo**: investimento mensal adicional, horizonte
  temporal (5/10/20/30 anos) e a própria taxa moderada.
- **Gráfico de linhas** com os 3 cenários e os valores finais projetados.

## Avisos importantes (e porque estão na própria UI)

- A taxa estimada a partir do teu histórico **não é uma taxa de retorno
  pura de mercado** — o valor do portefólio também sobe quando compras
  novas ações, por isso mistura performance real com capital novo
  investido. É só uma sugestão de ponto de partida.
- As projeções assumem uma taxa de retorno **constante** e um
  investimento mensal **constante** — simplificações que a vida real não
  respeita (os mercados sobem e descem de forma irregular).
- Isto é uma ferramenta de simulação para teres uma noção de ordem de
  grandeza, não uma previsão garantida nem aconselhamento financeiro.

## Testar

```bash
npm run dev
```
Abre Portefólio → confirma que aparece o valor total em destaque no topo,
e que a aba "Projeções" mostra o gráfico e os 3 cenários. Experimenta
mudar o investimento mensal, o horizonte e a taxa — o gráfico e os totais
por baixo devem atualizar-se de imediato.
