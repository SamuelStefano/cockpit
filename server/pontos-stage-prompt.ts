import type { AgentTasksRequest } from './pontos-agent';

// Prompt of "Novo épico com agente": the agent drafts epic → deliveries → tasks
// INTO the Deck (~/bin/deck-drafts), never into DFL. Samuel reviews the draft on
// /pontos and only then a second, explicit click sends it to DFL.

const brl = (cents: number): string => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildStageDraftsPrompt(req: AgentTasksRequest): string {
  const note = req.note.trim();
  return `Monte no Deck (NÃO no DFL) a estrutura épico → deliveries → tasks do trabalho abaixo, pra eu revisar em /pontos antes de ir pro DFL.

## O que estruturar

${note || '(Sem nota: descubra sozinho o que foi feito — varra as PRs mergeadas por mim nos repos DFL desde o último registro e use isso como escopo.)'}

## Regras de pontuação — inegociáveis

1. TETO POR ÉPICO: um épico rende no máximo ${brl(req.epicCapCents)} (a ${brl(req.pointValue * 100)}/ponto). Passou disso, QUEBRE em vários épicos — nunca corte pontos pra caber.
2. O teto do mês (hoje ${brl(req.monthCapCents)}) limita só a FATURA, não o trabalho. Registre o valor real.
- Pontos pela calibração vigente: 2h de pleno = 1pt, fator de era ~1,5, bump 1,3–1,7× pra cross-repo; bandas 0,5 1 1,5 2 3 4 5 6 8.
- Uma delivery por frente dentro do épico quando fizer sentido separar (ex.: front / backend); senão, uma só.

## Como gravar

1. Rode \`~/bin/deck-drafts list\` e não repita título de épico que já está lá.
2. Grave tudo num comando só, passando o markdown pelo stdin (sem criar arquivo):

~/bin/deck-drafts import - <<'EOF'
## Épico 1 — <título do épico> — <total> pt
### <título da delivery>        (opcional; sem ele vira "<épico> // Samuel")
- <título da task> — <refs de PR, ex. LS#577, campaigns#84> — <pontos>
EOF

3. Confira os avisos que o import imprimir (linha ignorada, total do cabeçalho diferente da soma).

NÃO use o MCP dfl-work pra escrever nada e NÃO gere fatura: criar no DFL é um clique meu depois da revisão.

## Ao terminar

Me diga no chat os épicos montados, com pt e R$ de cada, e o que ficou de fora.`;
}
