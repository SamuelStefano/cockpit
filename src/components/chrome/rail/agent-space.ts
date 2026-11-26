import type { TeamBot } from '../../../../shared/protocol';
import { departmentById } from '../../../../shared/departments';
import type { Session } from '../../../data/types';
import type { BotView } from '../../../routes/equipe/team-view';
import { displayTitle } from '../../sessions/display-title';

export interface AgentThread { id: string; title: string; when: string; current: boolean }

// The bot's open thread first, then the sessions it left behind on rotate (newest first),
// only the ones the box still lists.
export function agentThreads(view: BotView, sessions: Session[]): AgentThread[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const current = byId.get(view.key);
  const out: AgentThread[] = [{ id: view.key, title: current ? displayTitle(current.title) : 'Conversa atual', when: current?.relative ?? 'agora', current: true }];
  for (const id of [...(view.bot.previousSessionIds ?? [])].reverse()) {
    const s = byId.get(id);
    if (s && id !== view.key) out.push({ id, title: displayTitle(s.title), when: s.relative, current: false });
  }
  return out;
}

export const isChief = (bot: TeamBot, bots: Pick<TeamBot, 'parentId'>[]) => !bot.parentId && bots.some((b) => b.parentId === bot.id);

export function agentMeta(bot: TeamBot): string {
  return [bot.model, departmentById(bot.department)?.name].filter(Boolean).join(' · ');
}

export const isBusy = (v: BotView) => v.state === 'thinking' || v.state === 'working';
