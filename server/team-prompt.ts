import type { BotPermissions, TeamBot } from '../shared/protocol';
import { toolsDeniedBy } from '../shared/bot-access';
import { resolveSkillDeny } from './skills';
import { botIdFromKey } from '../shared/team';
import type { Role } from './auth';

const MAX_IDENTITY_BYTES = 16 * 1024;

function rosterLine(b: TeamBot, byId: Map<string, TeamBot>, team: TeamBot[]): string {
  const parts = [`- ${b.name}${b.primary ? ' (principal)' : ''}${b.label ? ` — ${b.label}` : ''}`];
  const boss = b.parentId ? byId.get(b.parentId) : undefined;
  if (boss) parts.push(`responde a ${boss.name}`);
  const reports = team.filter((x) => x.parentId === b.id).map((x) => x.name);
  if (reports.length) parts.push(`chefe de ${reports.join(', ')}`);
  return parts.join('; ');
}

// Identity goes through --append-system-prompt on every turn of the bot instead of
// being pasted into the first prompt: it stays out of the visible thread, and a
// session without a recorded snapshot (older CLI, or one compacted since) still
// gets it. The CLI's default --system-prompt-snapshot records the first launch's
// text, so an instructions edit reaches an existing thread only after a compact.
export function buildBotIdentity(bot: TeamBot, team: TeamBot[]): string {
  const byId = new Map(team.map((b) => [b.id, b]));
  const lines = [
    `Você é ${bot.name}${bot.label ? `, ${bot.label}` : ''}, um bot da equipe do Deck. Fale sempre como ${bot.name}.`,
    'Responda em prosa curta, números na frente: o que aconteceu, o que você decidiu, o que falta.',
    'Quando precisar de uma decisão do humano, explique o contexto em prosa antes e então use AskUserQuestion com uma pergunta e 2 a 4 opções curtas e mutuamente exclusivas. Marque a recomendada com "(Recomendada)" no fim do rótulo. Se houver um mockup ou print, passe o caminho dele em `image` na pergunta; se for segurar a rodada sem resposta, passe o horário em `deadline` (ex.: "10:30").',
    'Para mostrar uma imagem (mockup, gráfico, print), salve o arquivo no seu diretório de trabalho e cite com caminho relativo: ![legenda](nome.png).',
  ];
  if (bot.instructions.trim()) lines.push('', 'Suas instruções:', bot.instructions.trim());
  if (team.length > 1) {
    lines.push('', 'A equipe (a hierarquia é combinada, não imposta pelo sistema):');
    for (const b of team) lines.push(rosterLine(b, byId, team));
  }
  const text = lines.join('\n');
  const bytes = new TextEncoder().encode(text);
  return bytes.length <= MAX_IDENTITY_BYTES ? text : new TextDecoder().decode(bytes.slice(0, MAX_IDENTITY_BYTES));
}

// A turn belongs to a bot when its key names the bot (first turn / server turns)
// or when it resumes the session the bot is bound to — so a message typed into
// the bot's session from the normal chat still speaks as the bot.
export function findTurnBot(team: TeamBot[], sessionKey: string, sessionId?: string): TeamBot | undefined {
  const id = botIdFromKey(sessionKey);
  if (id) return team.find((b) => b.id === id);
  if (sessionId) return team.find((b) => b.sessionId === sessionId);
  return undefined;
}

export interface BotTurn {
  botId: string;
  resumeId?: string;
  appendSystemPrompt: string;
  model?: string;
  mode?: TeamBot['mode'];
  effort?: TeamBot['effort'];
  profile: TeamBot['profile'];
  skills?: string[];
  permissions?: BotPermissions;
}

// Deny rules a bot adds to its turn: tools switched off by its permissions plus
// every skill outside its list. Empty for a bot with neither field.
export async function botDenyRules(turn: Pick<BotTurn, 'skills' | 'permissions'> | undefined): Promise<string[]> {
  if (!turn) return [];
  return [...(turn.permissions ? toolsDeniedBy(turn.permissions) : []), ...(await resolveSkillDeny(turn.skills))];
}

// What a bot imposes on a turn. The bound session wins over the frame's sessionId:
// a tab still holding a draft key must land in the bot's one thread, not open a new one.
// A turn driven by anyone but admin is always restricted, whatever team.json says:
// a non-admin account can reach that file through other means, the profile it
// stored there must not be what unlocks Bash.
export function botTurnFor(team: TeamBot[], sessionKey: string, sessionId: string | undefined, role: Role | undefined): BotTurn | undefined {
  const turn = botTurnParams(team, sessionKey, sessionId);
  if (!turn || role === 'admin') return turn;
  return { ...turn, profile: 'restricted', ...(turn.permissions ? { permissions: { ...turn.permissions, write: false } } : {}) };
}

export function botTurnParams(team: TeamBot[], sessionKey: string, sessionId?: string): BotTurn | undefined {
  const bot = findTurnBot(team, sessionKey, sessionId);
  if (!bot) return undefined;
  return {
    botId: bot.id,
    resumeId: bot.sessionId ?? sessionId,
    appendSystemPrompt: buildBotIdentity(bot, team),
    profile: bot.profile === 'full' ? 'full' : 'restricted',
    ...(bot.model ? { model: bot.model } : {}),
    ...(bot.mode ? { mode: bot.mode } : {}),
    ...(bot.effort ? { effort: bot.effort } : {}),
    ...(bot.skills ? { skills: bot.skills } : {}),
    ...(bot.permissions ? { permissions: bot.permissions } : {}),
  };
}
