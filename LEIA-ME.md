# Como aplicar o rebranding para "Meu Capital"

## 1. Copia os ficheiros

| Ficheiro | Estado |
|---|---|
| `public/icons/icon-192.png` | novo/substituir |
| `public/icons/icon-512.png` | novo/substituir |
| `public/icons/icon-512-maskable.png` | novo/substituir |
| `src/app/icon.png` | novo/substituir (favicon automático do Next) |
| `src/app/apple-icon.png` | novo/substituir (ícone do ecrã principal no iPhone) |
| `src/app/manifest.ts` | substituir |
| `src/app/layout.tsx` | substituir |
| `src/app/login/page.tsx` | substituir |
| `src/components/nav-sidebar.tsx` | substituir |

Se ainda não tinhas aplicado os packs anteriores (PWA base + Fase 2), aplica-os
primeiro — este pack assume que `manifest.ts`, `layout.tsx` e `nav-sidebar.tsx`
já existem nesses caminhos.

## 2. O que mudou

- **Nome da app**: "Livro" → "Meu Capital", em todo o lado onde aparecia
  (manifest/PWA, título do separador do browser, ecrã de login, barra
  lateral).
- **Logo**: recortei o teu logo para um quadrado limpo e gerei os 4 formatos
  que a plataforma pede — favicon, ícone da Apple (180×180), ícone normal da
  PWA (192/512) e uma versão "maskable" (512, com mais margem à volta) para
  não ficar cortado quando o Android o mostra dentro de um círculo/squircle.
  Aparece agora na barra lateral (desktop) e no ecrã de login.
- Não mudei o nome do pacote no `package.json` (`patrimonio-app`) nem o nome
  do repositório — é só cosmético, mas diz se queres que troque também.

## 3. Testa

```bash
npm run dev
```

- O separador do browser deve mostrar "Meu Capital — Património & Finanças
  Pessoais" e o ícone novo.
- Login e barra lateral devem mostrar o novo nome e logo.
- Depois de fazeres deploy, tenta instalar a PWA outra vez (Android: prompt
  de instalar; iPhone: Partilhar → Adicionar ao ecrã principal) — o ícone e o
  nome no ecrã principal devem já ser os novos. Pode ser preciso desinstalar
  a versão antiga primeiro se já a tinhas instalado com o nome "Livro".
