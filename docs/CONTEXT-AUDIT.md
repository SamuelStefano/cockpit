# Auditoria de contexto do Deck

Medido em 25/10/2026 com `claude` 2.1.309, `--model haiku`, `--output-format json`,
prompt "Responda só: ok". Custo = `input_tokens + cache_creation + cache_read` da
primeira chamada do turno (o que o modelo lê antes de responder). Rodado com
`--no-session-persistence`, cwd igual ao do Deck. Variação entre rodadas ~±1k.

## Turno normal do chat (Deck → `server/engine/claude.ts`)

Argv padrão: `--strict-mcp-config` (zero MCP do `~/.claude.json`), `--mcp-config` só com
`deck-permission`, `--allowedTools` (pré-aprovação, não carrega definição), `--effort low`
(default da UI), skills sem seleção = todas.

| Variante | Tokens de entrada |
|---|---|
| Argv do Deck (permission MCP, todas as skills) | **39.243** |
| Sem `deck-permission` | 37.761 |
| Sem skills (`--disable-slash-commands`) | 32.949 |
| Sem settings do usuário (`--setting-sources ""`) | 27.570 |
| Só tools core (`--tools Bash,Read,Edit,Write,Glob,Grep,WebFetch,WebSearch,AskUserQuestion,TodoWrite,Agent,Skill`) | 34.421 |
| Sem tool nenhuma (`--tools ""`) | 12.403 |

## Tabela

| Item | Onde | Custo | Necessário? | Proposta |
|---|---|---|---|---|
| Definições das tools built-in do Claude Code | CLI (`claude.ts:203`, nenhum `--tools`) | ~26,8k tok/turno | Em parte: chat que edita precisa de Bash/Read/Edit | **Proposta**: `--tools` com o set core corta ~4,8k/turno (tira NotebookEdit, Monitor, Cron*, Task*, EnterWorktree…). Muda o que o agente consegue fazer → não implementado |
| Settings do usuário (`~/.claude/CLAUDE.md`, MEMORY, hooks) | CLI, cwd `CONFIG.workdir` | ~11,7k tok/turno | Sim: é a instrução dele | Não é do Deck; o Deck não escreve em `~/.claude/**` nem em `CLAUDE.md` (grep `server/`: nada grava lá). Fica |
| Listagem de skills | CLI; `src/cockpit/send-wire.ts:36` manda `skills` só com seleção; vazio = todas | ~6,3k tok/turno | Às vezes | **Proposta**: default "nenhuma skill" ou um set curto por área. Muda comportamento (skill some do chat) → não implementado. `Skill(...)` em `--disallowedTools` já tira a entrada da listagem (medido) |
| MCPs escolhidos | `claude.ts:284` (`pickMcpDefs`) | ~5–20k tok por server | Só quando escolhido | Default já é zero (`--strict-mcp-config`). Fica |
| `deck-permission` MCP | `claude.ts:148` (`mcpConfigBody`) | ~1,5k tok/turno | Sim: sem ele o CLI não registra AskUserQuestion/ExitPlanMode | Fica |
| `--effort` | `claude.ts:221`, default `low` (`useCockpit.ts:342`, crons `runs.ts` `fireCron`) | thinking | Sim | Já é o mínimo. Fica |
| Modelo default | `useCockpit.ts:1627` (`defaultModelRef`) | Opus ≈ 5× Sonnet por token | Escolha do dono | **Proposta** (memória `cockpit_token_cost_drivers`): default Sonnet. Visível → não implementado |
| Identidade de bot (Equipe) | `team-prompt.ts:21` → `--append-system-prompt` (`claude.ts:235`) | 483 B base (~120 tok) + instruções + 1 linha por bot; teto 16 KB | Sim | Snapshot do CLI grava 1x por conversa. Enxuto. Fica |
| Bot via ACP | `agents/acp-run.ts:134` | mesma identidade, só no 1º prompt | Sim | Fica |
| Anexos | `shared/parse-attachments.ts` `encodeAttachments` | ~60 B por `[anexo: path]`; `.docx` inline até 200k chars (`attachments.ts:41`), limitado pelo teto de 100 KB do prompt | Sim | Fica |
| Retomada após falha | `runs.ts:82` `RESUME_PROMPT` | 129 B | Sim | Fica |
| Fila com merge | `runs.ts:1141`, `pending.ts:71` "Complemento do pedido anterior:" | 33 B | Sim | Fica |
| Interrupção `priority` | `runs.ts:1258` → `ws/priority-carry.ts` | **antes: até 103 KB** (prompt anterior inteiro, já no transcript, + 3 KB de progresso) | O progresso sim; o prompt repetido não | **Cortado**: com sessão pra retomar, o prompt anterior vira ponteiro de 600 chars (marcadores de card/fluxo preservados). Depois: ≤3,7 KB |
| Card do kanban | `shared/canvas-prompt.ts:38` `buildTaskPrompt` | 160 B de moldura + 1 linha por contexto/sessão | Sim | Fica |
| Card de conteúdo | `shared/canvas-prompt.ts:63` | 470 B de moldura | Sim | Fica |
| Fluxo do canvas | `canvas/flows.ts:40` `MAX_RESULT_CHARS` | até 12.000 chars (~3k tok) do resultado anterior | Sim | **Proposta**: 6.000 chars. Muda o que o nó seguinte vê → não implementado |
| Retomar de contexto (handoff) | `useCockpit.ts:1187` | ~60 B | Sim | Fica |
| Cron | `runs.ts` `fireCron` | prompt do cron, `effort low` | Sim | Fica |
| **Triagem `classify`** (por mensagem enviada com turno ocupado) | `engine/triage.ts:130` | **antes: 30.394 tok/chamada** (system prompt do Claude Code + tools + skills + settings/hooks do usuário) | Só o texto da triagem | **Cortado**: `--tools ""`, `--disable-slash-commands`, `--setting-sources ""`, `--no-session-persistence`, `--system-prompt` próprio. Depois: **2.179 tok** (−93%). Mesmo veredito (testado ao vivo) |
| Resposta rápida `quickAnswer` | `engine/triage.ts:135` | ~30k tok/chamada | Tools (WebSearch) e estilo do usuário fazem parte da resposta | Só `--no-session-persistence` (some o JSONL fantasma). **Proposta**: `--tools WebSearch,WebFetch --disable-slash-commands` (~−20k) |
| Keep-alive do OAuth | `ws/auth-health.ts:78` (a cada 5 min, dispara só perto da expiração) | ~30k tok/ping | Só a chamada importa, a resposta é descartada | **Cortado**: mesmos flags enxutos. Depois ~2,2k (igual à triagem enxuta, ambos em plan mode) |
| Motor de plano do harness | `harness/plan-run.ts:111` | **antes: 21.287 tok/tarefa** de scaffolding | Só texto | **Cortado**: `--tools ""` (também fecha leitura por construção, não só pela deny-list), sem skills/settings/transcript. Depois: **574 tok** |
| Sonda de slash commands | `ws/slash-probe.ts:15` | ~0 (morre no `system/init`, antes da inferência) | Sim (popula a paleta "/") | Fica. Não pode ganhar `--disable-slash-commands` |
| Resumo da sessão | `summary.ts` (API direta, haiku) | ~1,5k tok entrada + 60 saída por turno, throttle 90 s | Mostra no sidebar | Fora do contexto do chat. Já tem `COCKPIT_SUMMARY=off`. Fica |

## Cortes aplicados (reversíveis)

`COCKPIT_LEAN_ONESHOTS=off` (documentado no `.env.example`) volta o argv antigo de
triagem, keep-alive e motor de plano. O corte da interrupção `priority` não tem flag:
só afeta texto que o modelo já tem no transcript.

| Corte | Antes | Depois |
|---|---|---|
| Triagem `classify` | 30.394 tok | 2.179 tok |
| Keep-alive OAuth | ~30k tok | ~2,2k tok |
| Motor de plano | 21.287 tok | 574 tok |
| Carry da interrupção `priority` (prompt de 100 KB) | 103.119 B | 3.722 B |
