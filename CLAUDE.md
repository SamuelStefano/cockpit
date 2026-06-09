# Deck — Convenções do projeto

App pessoal (não DFL). React 18 + Vite + TS + Tailwind. Backend Node em `server/`.

## Design system — OBRIGATÓRIO

Toda UI nova usa os primitivos de `src/components/primitives`. Não recriar inline o
que já existe como primitivo. Galeria viva em `/ds`.

| Precisa de… | Use | Não faça |
|-------------|-----|----------|
| Botão | `<Button>` (`primary`/`secondary`/`ghost`/`danger`, `sm`/`md`, `icon`, `loading`) | `<button className="bg-orange-500…">` solto |
| Estado vazio de página | `<EmptyState icon title description>` | div centralizada ad-hoc |
| Selo/etiqueta | `<Badge tone>` | span pill inline |
| Ícone | `<Icon name>` | SVG inline |
| Cores/raio/foco/superfície | `tokens` de `primitives/tokens.ts` | hex/classe mágica repetida |

Faltou variante? Estenda o primitivo (e adicione à galeria `/ds`), não bifurque com
classe inline. Cor de acento do Deck = `orange-500`.

## Estrutura

- Um componente por arquivo; arquivo em `PascalCase.tsx`, igual ao componente.
- Componente só renderiza JSX. Lógica (estado, efeitos, derivações) vai em hook próprio.
- Arquivo de UI acima de ~150 linhas → quebrar.
- Teste ao lado do arquivo testado (`x.ts` + `x.test.ts`), não em `__tests__/`.
- Comentários só explicam o WHY não-óbvio; zero comentário decorativo.

## Git

- Branch por tarefa (`feat/`, `fix/`, `chore/`), base na `main` atualizada.
- Commit `tipo: descrição` em português, sem corpo e sem trailers de autoria.
- PR por tarefa; validar `tsc --noEmit`, `vitest run` e `vite build` antes de finalizar.
