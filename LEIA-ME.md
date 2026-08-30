# Como aplicar estas alterações

## 1. Corrige a base de dados (isto é o que está a causar o erro #441)

Vai ao **SQL Editor** do teu projeto Supabase e corre:

```sql
alter type account_type add value if not exists 'poupanca';
```

É idempotente — não faz mal correr mais do que uma vez.

## 2. Copia os ficheiros para o projeto

Todos os caminhos abaixo são relativos à raiz do projeto (onde está o `package.json`).
Ficheiros **novos** — cria-os. Ficheiros que já existem — substitui o conteúdo pelo daqui.

| Ficheiro | Estado |
|---|---|
| `src/app/manifest.ts` | novo |
| `src/app/layout.tsx` | substituir |
| `src/app/globals.css` | substituir |
| `src/app/contas/actions.ts` | substituir |
| `src/components/mobile-nav.tsx` | novo |
| `src/components/nav-sidebar.tsx` | substituir |
| `src/components/register-sw.tsx` | novo |
| `src/components/accounts/account-form.tsx` | substituir |
| `src/components/accounts/archive-account-button.tsx` | substituir |
| `public/sw.js` | novo |

## 3. Falta só isto (não consigo gerar imagens binárias): os ícones da app

Cria estes 4 ficheiros de imagem e coloca-os nos caminhos indicados (usa por exemplo
https://realfavicongenerator.net ou https://maskable.app para gerar a versão "maskable"):

- `public/icons/icon-192.png` — 192×192
- `public/icons/icon-512.png` — 512×512
- `public/icons/icon-512-maskable.png` — 512×512, com a arte centrada e margem de segurança (~20%)
- `src/app/apple-icon.png` — 180×180 (o Next usa este automaticamente como ícone da Apple)

Opcional mas recomendado: `src/app/icon.png` (qualquer tamanho quadrado) — o Next gera o
favicon automaticamente a partir dele.

## 4. Testa

```bash
npm run dev
```

- Tenta criar uma conta do tipo "Poupança" — deve funcionar agora.
- Abre no telemóvel (ou emula um ecrã pequeno no DevTools) — deves ver a barra de
  navegação fixa em baixo.
- Depois de fazer deploy (o service worker só regista em produção/HTTPS de forma
  fiável), no Android/Chrome deve aparecer a opção de instalar a app; no iPhone,
  Partilhar → "Adicionar ao ecrã principal".

## Nota

Se quiseres o mesmo tratamento de erros (`{ error }` em vez de `throw`) aplicado a
`src/app/transacoes/actions.ts`, diz que faço o mesmo pack para esses ficheiros.
