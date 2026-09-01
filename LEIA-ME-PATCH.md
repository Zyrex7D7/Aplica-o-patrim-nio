# Patch — corrige erro de importação DEGIRO + overflow no mobile

## Como aplicar

Copia a pasta `src/` (e `supabase/` se quiseres correr o SQL de novo) desta
pasta para dentro do teu projeto, respeitando os mesmos caminhos. Todos os
ficheiros aqui **substituem por inteiro** os equivalentes no teu projeto —
não é preciso fazer merge manual.

```
patch/
├── src/
│   ├── app/
│   │   ├── layout.tsx                          substituir
│   │   ├── dashboard/page.tsx                  substituir
│   │   ├── portfolio/page.tsx                  substituir
│   │   └── api/degiro/import/route.ts          substituir
│   └── components/
│       ├── portfolio/
│       │   ├── degiro-upload.tsx               substituir
│       │   └── wipe-imports-button.tsx         substituir
│       └── reports/
│           └── budget-list.tsx                 substituir
└── supabase/
    └── schema.sql                              opcional, ver abaixo
```

## 1. O erro da foto (foreign key `asset_transactions_import_id_fkey`)

**Causa:** em `src/app/api/degiro/import/route.ts`, o código gerava um
`importId` novo e já inseria as `asset_transactions` a apontar para ele —
antes de a linha correspondente existir em `csv_imports`. Como
`asset_transactions.import_id` tem uma foreign key para `csv_imports.id`,
a base de dados recusava o insert.

**Correção:** o novo `route.ts` cria primeiro a linha em `csv_imports`, só
depois insere as transações a apontar para ela, e no fim atualiza as
contagens finais (inseridas/duplicadas). Se a inserção das transações
falhar por qualquer razão, a linha de importação criada é removida
(rollback), para nunca ficar uma importação "fantasma" com 0 transações.

**Não precisas de mudar nada na base de dados** — a foreign key e a
cascade no `schema.sql` já estavam corretas, o problema era só a ordem das
operações no código. Incluí `supabase/schema.sql` mesmo assim, sem
alterações de fundo, só para teres tudo consolidado num único ficheiro se
alguma vez precisares de recriar a base de dados do zero — podes correr no
SQL Editor da Supabase em segurança (é idempotente).

**Antes de testares de novo:** a importação que falhou pode ter deixado
"lixo" (ex: um ativo criado sem transações). Usa o botão **"Apagar tudo e
recomeçar"** em Portefólio antes de voltar a importar o CSV, para começares
limpo.

## 2. Overflow no mobile

- **`degiro-upload.tsx`** — a mensagem de erro (como a da foto,
  `asset_transactions_import_id_fkey`, uma palavra sem espaços) já quebra
  linha em vez de esticar a caixa para fora do ecrã (`break-words`).
- **`dashboard/page.tsx`** — o valor grande do património usa um tamanho
  de letra menor em ecrãs estreitos e quebra linha se for preciso; os
  cartões de "Capital investido" / "Lucro" também já não estouram.
- **`portfolio/page.tsx`** — o cabeçalho "Importar Extrato DEGIRO" (com os
  botões "Remover última importação" e "Apagar tudo") passa a empilhar
  verticalmente em ecrãs pequenos em vez de espremer tudo numa linha.
- **`wipe-imports-button.tsx`** — o modo de confirmação ("Escreve APAGAR" +
  botões) agora quebra linha em vez de sair do cartão.
- **`budget-list.tsx`** — nomes de categoria longos são cortados com "..."
  (`truncate`) em vez de empurrarem os valores para fora da linha.
- **`layout.tsx`** — `overflow-x-hidden` no `<html>`/`<body>` como rede de
  segurança geral, para qualquer overflow residual não criar uma barra de
  scroll horizontal na app inteira.

## Testar

```bash
npm run dev
```

1. Reduz a largura da janela (ou usa o modo mobile das DevTools) e percorre
   Dashboard, Portefólio e Relatórios → Orçamentos — nada deve sair da
   largura do ecrã nem aparecer scroll horizontal.
2. Em Portefólio, clica "Apagar tudo e recomeçar" (escreve `APAGAR`) para
   limpar qualquer resíduo da importação que falhou.
3. Importa novamente o CSV da DEGIRO — deve completar sem o erro da foreign
   key, e o histórico em "Ver importações" deve mostrar a linha com as
   contagens corretas.
