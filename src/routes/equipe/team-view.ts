import type { TeamBot, TeamPendingQuestion } from '../../../shared/protocol';
import { botDraftKey } from '../../../shared/team';
import { trafficLine, type TeamMessage } from '../../../shared/team-messages';
import type { Session } from '../../data/types';
import { deriveBotState, type BotState } from '../../components/team/botState';
import type { Phase } from '../../components/chat/useChatPanel';

export interface BotView {
  bot: TeamBot;
  key: string;
  preview: string;
  unread: boolean;
  state: BotState;
  startedAt?: number;
  pending?: TeamPendingQuestion;
}

export interface TeamViewCtx {
  sessions: Session[];
  running: Set<string>;
  activeId: string;
  phase: Phase;
  interrupted: Record<string, string>;
  runStart: Record<string, number>;
  seen: Record<string, number>;
  selectedId: string | null;
  now: number;
  lastTraffic?: Record<string, TeamMessage>;
  nameOf?: (id: string) => string;
  pending?: Record<string, TeamPendingQuestion>;
}

export const WAITING_PREFIX = 'Esperando você: ';

export function pendingByBot(items: TeamPendingQuestion[]): Record<string, TeamPendingQuestion> {
  return Object.fromEntries(items.map((p) => [p.botId, p]));
}

// The newest bot↔bot message each bot took part in: the roster preview shows it
// when it is newer than the bot's own thread ("Mandou para X: …").
export function lastTrafficByBot(log: TeamMessage[]): Record<string, TeamMessage> {
  const out: Record<string, TeamMessage> = {};
  for (const m of log) {
    for (const id of [m.from, m.to]) if (!out[id] || out[id].ts <= m.ts) out[id] = m;
  }
  return out;
}

// The chat key a bot's thread lives under right now: its bound session, else
// the draft key its first turn starts from.
export const botChatKey = (bot: TeamBot) => bot.sessionId ?? botDraftKey(bot.id);

// Primary first, then the order the bots were created in.
export function orderBots(bots: TeamBot[]): TeamBot[] {
  return [...bots].sort((a, b) => Number(!!b.primary) - Number(!!a.primary) || a.createdAt - b.createdAt);
}

export function botView(bot: TeamBot, ctx: TeamViewCtx): BotView {
  const key = botChatKey(bot);
  const s = ctx.sessions.find((x) => x.id === key) ?? (bot.sessionId ? undefined : ctx.sessions.find((x) => x.id === botDraftKey(bot.id)));
  const running = ctx.running.has(key);
  const pending = ctx.pending?.[bot.id];
  const state = deriveBotState({
    running,
    phase: key === ctx.activeId ? ctx.phase : undefined,
    waiting: s?.waiting || !!pending,
    failed: !!ctx.interrupted[key] || s?.lastTurnOk === false,
    lastTurnOk: s?.lastTurnOk,
    endedAt: s?.mtime,
    now: ctx.now,
  });
  const traffic = ctx.lastTraffic?.[bot.id];
  const own = s?.snippet && s.snippet !== 'Sem mensagens ainda' ? s.snippet : '';
  const asked = pending?.questions[0]?.question;
  const preview = asked ? `${WAITING_PREFIX}${asked}` : (traffic && traffic.ts > (s?.mtime ?? 0) ? trafficLine(bot.id, traffic, ctx.nameOf ?? ((id) => id)) : own) || bot.label || 'Sem mensagens ainda';
  const unread = bot.id !== ctx.selectedId && !!s && s.mtime > (ctx.seen[bot.id] ?? 0) && !!bot.sessionId;
  return { bot, key, preview, unread, state, startedAt: ctx.runStart[key], pending };
}
