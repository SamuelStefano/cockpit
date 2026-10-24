import type { TeamBot } from '../../../shared/protocol';
import { botDraftKey } from '../../../shared/team';
import type { Session } from '../../data/types';
import { deriveMascotState, type MascotState } from '../../components/team/mascot-state';
import type { Phase } from '../../components/chat/useChatPanel';

export interface BotView {
  bot: TeamBot;
  key: string;
  preview: string;
  unread: boolean;
  state: MascotState;
  startedAt?: number;
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
  const state = deriveMascotState({
    running,
    phase: key === ctx.activeId ? ctx.phase : undefined,
    waiting: s?.waiting,
    failed: !!ctx.interrupted[key] || s?.lastTurnOk === false,
    lastTurnOk: s?.lastTurnOk,
    endedAt: s?.mtime,
    now: ctx.now,
  });
  const preview = (s?.snippet && s.snippet !== 'Sem mensagens ainda' ? s.snippet : '') || bot.label || 'Sem mensagens ainda';
  const unread = bot.id !== ctx.selectedId && !!s && s.mtime > (ctx.seen[bot.id] ?? 0) && !!bot.sessionId;
  return { bot, key, preview, unread, state, startedAt: ctx.runStart[key] };
}
