# Redesenho completo ao estilo sharpyield

## 1. SQL (Supabase → SQL Editor, por esta ordem)
1. `supabase/005_cotacoes_eur.sql`  (cotações em EUR, fecho anterior, bolsa do ativo)
2. `supabase/006_radar.sql`         (tabela do Radar)

## 2. Copiar ficheiros (substituem/criam; mesmos caminhos dentro de `src/`)
Substituem:
- `app/globals.css`, `app/layout.tsx`, `app/dashboard/page.tsx`, `app/portfolio/page.tsx`
- `app/api/quotes/route.ts`
- `components/ui/card.tsx`, `components/bottom-nav.tsx`, `components/mobile-header.tsx`
- `components/portfolio/holdings-table.tsx`
- `lib/nav-items.ts`, `lib/data/net-worth.ts`, `lib/market/quotes.ts`

Novos:
- `app/radar/{page.tsx,actions.ts}`, `app/noticias/page.tsx`, `app/mais/{page.tsx,actions.ts}`
- `components/ui/ticker-avatar.tsx`
- `components/radar/{watchlist-add.tsx,remove-watch-button.tsx}`
- `components/dashboard/{record-card,return-chart,weight-treemap,best-worst}.tsx`
  (e `hero-card.tsx` + `top-movers.tsx`, que substituem os da ronda anterior)
- `lib/ticker.ts`, `lib/data/header-summary.ts`

Podes apagar `components/mobile-nav.tsx` (já não é usado).

## 3. Bolsa da DEGIRO no parser (ver LEIA-ME-RONDA-3.md do patch anterior, passo 3 e 4)

## Notas
- O tema agora é azul-marinho; `text-gold`/`bg-gold` passaram a ser o azul de destaque.
- Sem logos reais das empresas: usei quadrados com as iniciais do ticker.
- "Mercado aberto/encerrado" é uma aproximação por horário (dias úteis, 07–21h UTC).
- "Retorno total acumulado" e "Máximo histórico" usam os snapshots diários, por isso
  só têm histórico a partir do dia em que a app começou a guardá-los.
- Alocação setorial não está incluída: não temos o setor de cada ativo guardado.
