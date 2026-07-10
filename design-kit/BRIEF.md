# Deck — Design Brief (anexe este arquivo em qualquer sessão de design)

> Este arquivo é autossuficiente: contém tudo que um agente de design precisa pra
> propor/gerar UI do Deck sem acesso ao repositório. Anexe-o junto com screenshots
> da tela atual e o pedido. O output deve seguir o **Formato de resposta** no final.

## 1. O que é o Deck

Painel pessoal de controle de agentes Claude rodando numa VPS: chat com o agente
(estilo ChatGPT), terminais reais (PTY), sessões persistentes, análise de uso/custo,
crons, knowledge-graph do código, admin da VPS. SPA React 18 + Vite + TS + Tailwind;
uma só pessoa usa (dono técnico, dev sênior). Mobile é cidadão de primeira classe —
metade do uso é do celular, em eventos.

## 2. Identidade visual — "black moderno alaranjado"

Estética Linear/Vercel-dark: fundo quase preto com leve tom frio, acento **laranja**
(`#f97316`) usado com parcimônia (ações primárias, foco, marca). Nada de roxo,
nada de light theme, nada de gradientes coloridos de IA genérica. Profundidade vem
de camadas de superfície + um halo laranja sutil no topo do body, não de sombras
pesadas.

### Paleta (escala `neutral` é CUSTOM — use estes hex)

| Token Tailwind | Hex | Uso |
|---|---|---|
| `neutral-950` | `#080809` | fundo profundo (body) |
| `neutral-900` | `#101013` | fundo de painel/chat |
| `neutral-800` | `#19191d` | bordas padrão, superfícies sutis |
| `neutral-700` | `#27272c` | bordas elevadas, hover de borda |
| `neutral-600` | `#3d3d44` | texto desabilitado, ícones apagados |
| `neutral-500` | `#5b5b64` | texto muted |
| `neutral-400` | `#82828c` | texto secundário fraco |
| `neutral-300` | `#a9a9b2` | texto de corpo |
| `neutral-200` | `#d2d2d8` | texto de corpo forte |
| `neutral-100` | `#e9e9ec` | texto primário |
| accent | `#f97316` (`orange-500`) | ações primárias, foco, destaques |
| accent soft | `#fb923c` (`orange-400`) | texto/ícone de acento |
| ok / warn / err | `#22c55e` / `#eab308` / `#ef4444` | estados |

CSS vars existentes: `--bg #101013`, `--bg-deep #080809`, `--term-bg #050506`,
`--border #19191d`, `--accent #f97316`, `--ring rgba(249,115,22,.45)`.

Fundo do body (não recriar, já existe):
`radial-gradient(120% 75% at 50% -20%, rgba(249,115,22,0.06), transparent 55%)` sobre `#080809`.

### Tipografia

- Sans: **Geist** (fallback system-ui). Mono: **Geist Mono**.
- Body: `letter-spacing: -0.011em`; títulos um pouco mais apertados.
- Texto de resposta do chat: `15.5px / leading-7`. UI densa: 11–13px.
- Labels de seção: `text-[10.5px] font-semibold uppercase tracking-wide text-neutral-600`.

### Raio e superfície

- Radius global remapeado: `rounded-lg = 0.75rem`, `rounded-xl = 1rem`, `rounded-2xl = 1.25rem`.
- Superfícies canônicas (classes prontas do design system):
  - base: `bg-neutral-900/60 border border-neutral-800`
  - raised (popover/modal): `bg-neutral-950 border border-neutral-700 shadow-lg shadow-black/40`
  - glass: `bg-neutral-900/70 border border-neutral-800 backdrop-blur-md`
- Acento primário: `bg-gradient-to-b from-orange-500 to-orange-600` (nunca laranja chapado em botão primário).
- Foco SEMPRE: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40`.

### Motion

Sutil e curto: `fade-up` (opacity+translateY 7px, 0.28s cubic-bezier(0.22,1,0.36,1)) pra
entrada de mensagens/cards; `scaleIn` pra modais; shimmer pra skeletons; respeitar
`prefers-reduced-motion`. Nada de animação contínua chamativa.

## 3. Design system existente (USE, não recrie)

Primitivos em `src/components/primitives` — todo output deve usá-los:

- `<Button variant="primary|secondary|ghost|danger" size="sm|md" icon="..." square loading>` — botão primário já vem com o gradiente laranja.
- `<Badge tone="...">` — selos/etiquetas (tones das cores de estado).
- `<EmptyState icon title description action>` — estado vazio de página/painel.
- `<Icon name="..." size={n}>` — ícones internos (stroke 2, estilo Lucide). Nomes disponíveis:
  `terminal plus search menu send arrowUp chevronDown chevronUp chevronRight chevronLeft check x square play rotate message pencil zap trash sparkles claude panelRight circle user copy command grip download paperclip clock star file tag shield shield-off mic image volume`.
- `<Input>`, `<Skeleton>`, `<SkeletonCards>`, `<ConnDot>`, `<CodeBlock code lang>`, `<Markdown md>`.
- `tokens` (objeto TS): `tokens.focusRing`, `tokens.surface.base|raised|glass`, `tokens.text.primary|secondary|muted|accent`, `tokens.radius.*`, `tokens.accentGradient`.

Regras de código da casa:
- Um componente por arquivo (`PascalCase.tsx`); lógica em hook próprio (`useXxx.ts`); arquivo de UI >150 linhas → quebrar.
- Comentários só de WHY não-óbvio.
- Mobile-first: breakpoints `sm:` (640) e `md:` (768); alvos de toque ≥40px; usar `100dvh` (nunca `100vh`); respeitar safe-area insets.

## 4. Anatomia das superfícies (pra ler os screenshots)

- **Header** (topo): logo Deck à esquerda, navegação por rotas (Chat, Contextos, Skills, Notas, Crons, Uso, Graph, Docs, Admin), cluster direito com barra de usage do plano + perfil. Mobile: hamburger + drawer.
- **Sidebar de sessões** (esquerda no desktop, drawer no mobile): busca, grupos por recência (Trabalhando agora / Fixadas / Hoje / Ontem / 7 dias...), cards com título, resumo IA, custo, indicadores de run.
- **Chat** (centro): thread com avatar do Claude por resposta, bolha do usuário à direita, tool calls colapsáveis, task tray, chips de follow-up pós-resposta, composer com toolbar (modo/modelo/effort/skills/MCP), anexos, mic, fila de mensagens.
- **StatusBar** (rodapé): CPU/RAM/disco da VPS, custo, contexto, reset da janela de rate.
- **Rotas**: cards em grid (Contextos/Skills), editor (Notas), lista+form (Crons), dashboard (Uso), canvas force-directed (Graph), docs com aside (Docs), tabs (Admin).

## 5. Anti-padrões (rejeite no design)

- Recriar botão/badge/empty-state inline em vez do primitivo.
- Hex mágico fora da paleta acima; `bg-orange-500` chapado em CTA (usar o gradiente).
- Light theme, roxo/violeta, glassmorphism exagerado, neon, Inter/Roboto.
- Bordas `border-neutral-700` como default (700 é só elevado/hover — default é 800).
- Ícones emoji no lugar de `<Icon>`; sombras pesadas em superfícies base.
- Denso demais no mobile: toque <40px, texto <11px.

## 6. Formato de resposta exigido

1. **Direção** (2-4 frases): o que muda e por quê, em termos de hierarquia/densidade/fluxo.
2. **Mockup em código**: JSX + Tailwind pronto pra colar, usando os primitivos e a paleta
   acima (imports de `../primitives` podem ser assumidos). Um componente por bloco,
   com estados: hover, focus-visible, disabled, loading (skeleton), empty e mobile (`sm:`).
3. **Diff conceitual**: lista curta "antes → depois" por elemento tocado.
4. Se propuser um primitivo novo: assinatura + onde entra na galeria `/ds`.

Nunca devolver HTML solto, CSS files separados ou bibliotecas novas (nada de shadcn/MUI/styled-components — o design system é próprio).
