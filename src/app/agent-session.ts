import type { TeamBot } from '../../shared/protocol';
import { botDraftKey, botIdFromKey } from '../../shared/team';

// Which agent owns the open chat: a bot's thread is its bound session or the
// draft key its first turn starts from. null = a plain conversation.
export function agentIdForSession(bots: Pick<TeamBot, 'id' | 'sessionId'>[], activeId: string): string | null {
  if (!activeId) return null;
  const bound = bots.find((b) => b.sessionId === activeId || botDraftKey(b.id) === activeId);
  if (bound) return bound.id;
  const fromKey = botIdFromKey(activeId);
  return fromKey && bots.some((b) => b.id === fromKey) ? fromKey : null;
}
