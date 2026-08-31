# Menu lateral no telemóvel (hambúrguer)

## Ficheiros

| Ficheiro | Estado |
|---|---|
| `src/lib/nav-items.ts` | novo — lista única de secções, usada por todos os menus |
| `src/components/mobile-header.tsx` | novo — cabeçalho fixo no topo (mobile) + painel lateral |
| `src/components/mobile-nav.tsx` | substituir — passa a usar a lista partilhada |
| `src/components/nav-sidebar.tsx` | substituir — passa a usar a lista partilhada |
| `src/app/layout.tsx` | substituir — liga o `MobileHeader` e ajusta o espaçamento |

## O que muda

- **Novo cabeçalho fixo no topo**, só em ecrãs pequenos (`md:hidden`): logo +
  nome à esquerda, ícone de hambúrguer à direita.
- Tocar no hambúrguer abre um **painel lateral** com as 6 secções (incluindo
  "Recorrências", que não cabia na barra de baixo): Património, Contas,
  Movimentos, Recorrências, Relatórios, Portefólio.
- O painel fecha ao tocar fora dele, no X, ou automaticamente ao navegares
  para outra secção.
- A barra de baixo (5 ícones) continua igual — serve para os atalhos mais
  usados; o menu lateral é que dá acesso a tudo.
- `src/lib/nav-items.ts` passa a ser a única lista de secções — já não há
  risco de um menu ter uma secção e outro não (foi o que aconteceu com
  "Recorrências" da última vez).

## Testa

```bash
npm run dev
```
Reduz a largura da janela (ou usa o modo mobile das DevTools) e confirma:
- O cabeçalho novo aparece no topo, o conteúdo da página não fica escondido
  atrás dele nem da barra de baixo.
- O hambúrguer abre o painel com as 6 secções, e "Recorrências" já lá está.
- No desktop (ecrã largo) nada disto aparece — mantém-se a barra lateral
  normal.
