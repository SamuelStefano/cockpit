# Design Kit do Deck

Kit pra pedir UI melhorada a um Claude de design (claude.ai, desktop ou outra sessão)
e receber de volta código já alinhado ao design system do app.

## Como usar (3 passos)

1. Tire screenshots da superfície que quer melhorar (tela inteira; desktop e mobile se houver).
2. Abra o [PROMPT.md](./PROMPT.md), copie o prompt, preencha os `[colchetes]`.
3. Envie no chat de design: o prompt + **anexe o [BRIEF.md](./BRIEF.md)** + os screenshots.

O retorno vem como: direção de design → mockup JSX+Tailwind usando os primitivos do
Deck → diff conceitual. Pra aplicar, cole o mockup num chat do Deck com
"aplica este mockup em `<arquivo>`, adaptando pros dados reais".

## Manutenção

O BRIEF espelha `src/components/primitives/tokens.ts`, `tailwind.config.js` e
`src/index.css`. Mudou paleta/token/primitivo? Atualize o BRIEF no mesmo commit.
