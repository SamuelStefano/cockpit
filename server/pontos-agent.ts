// Prompt do agente "criar tasks" disparado pelo botão em /pontos. O texto é
// construído AQUI (puro e testável), não no cliente: as duas regras de teto são
// política do Samuel e não podem depender de o front mandar a versão certa.
// Espelha fireCron — o botão é um turno autônomo com um prompt fixo + a nota dele.

export interface AgentTasksRequest {
  note: string;
  epicCapCents: number;
  monthCapCents: number;
  pointValue: number;
}

const brl = (cents: number): string => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const MAX_NOTE_BYTES = 8_000;

export function agentSessionKey(now: number): string {
  return `pontos-agent-${now.toString(36)}`;
}

export function buildAgentTasksPrompt(req: AgentTasksRequest): string {
  const note = req.note.trim();
  return `Registre no DFL o trabalho abaixo como épico(s) + delivery + tasks, usando o MCP dfl-work.

## O que registrar

${note || '(Sem nota: descubra sozinho o que foi feito — varra as PRs mergeadas por mim nos repos DFL desde o último registro e use isso como escopo.)'}

## Regras de pontuação — as duas são inegociáveis

1. TETO POR ÉPICO: um épico rende no máximo ${brl(req.epicCapCents)} (a ${brl(req.pointValue * 100)}/ponto). Se o trabalho vale mais que isso, QUEBRE em vários épicos — não corte pontos pra caber. Nenhum épico pode passar do teto.
2. TETO DO MÊS é outra coisa: podem existir dezenas de épicos no mesmo mês somando muito acima do teto mensal (hoje ${brl(req.monthCapCents)}), e tudo bem. Eles ficam existindo. O teto mensal só limita o que VIRA FATURA.

Então: registre o valor REAL do trabalho, sempre. O que não cabe no mês não é descontado — fica em espera até o Tainan poder pagar.

## Como fazer

- Antes de criar, rode list_epics/list_deliveries e confira se já existe épico pro mesmo escopo. Não duplique.
- Um épico por frente de trabalho coerente, no projeto certo (list_projects).
- Uma delivery por épico, price_per_point ${req.pointValue}, owner = eu (member ef7d8a76-9549-4ddc-ae68-73099226d9c0).
- Épico que já nasce acima do teto: crie os épicos extras e escreva no notes de cada um "EM ESPERA — fatura quando a DFL puder pagar", com a referência do épico irmão.
- Toda task: status conforme a realidade (done pro que já mergeou), stage_id execution, points pela calibração vigente (2h de pleno = 1pt, fator de era ~1,5, bump 1,3–1,7× pra cross-repo), e context com why (a dor) e what (o que foi feito), citando os números das PRs.
- NÃO gere fatura. Faturar é ação minha, no botão do Deck, respeitando o teto do mês.

## Ao terminar

- Rode o sync do Deck: \`npx tsx server/dfl-sync.ts\` em ~/cockpit.
- Me diga no chat: épicos criados, valor de cada um, quanto ficou em espera e o total do mês.`;
}
