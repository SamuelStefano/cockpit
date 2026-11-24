import type { TeamBot } from '../../../shared/protocol';
import { botIdFromKey } from '../../../shared/team';

// A bot's thread lives in the Team panel; listing it in the sessions sidebar too
// filled it with one row per bot opened (its `new-bot-<id>` draft or bound session).
export function withoutBotThreads<T extends { id: string }>(sessions: T[], bots: Pick<TeamBot, 'sessionId'>[]): T[] {
  const bound = new Set(bots.map((b) => b.sessionId).filter((id): id is string => !!id));
  return sessions.filter((s) => !bound.has(s.id) && !botIdFromKey(s.id));
}
