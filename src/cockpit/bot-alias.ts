import type { TeamBot } from '../../shared/protocol';
import { botDraftKey, botThreadKey } from '../../shared/team';

// Server-side bot turns (a routine, a delivered team message) run under
// `bot-<id>`, but the bot's thread lives under its bound session id, or under
// the draft key before the first turn. Every stream frame goes through
// resolveKey(migratedTo), so pointing `bot-<id>` at the thread's key there is
// what makes the live stream and the "working" mascot land in the open thread.
// An unbound bot aliases to its draft: the turn's `done` then migrates the
// draft to the session it got, like any new chat.
export function botAliases(bots: Pick<TeamBot, 'id' | 'sessionId'>[], migratedTo: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of bots) {
    const draft = botDraftKey(b.id);
    out[botThreadKey(b.id)] = b.sessionId ?? migratedTo[draft] ?? draft;
  }
  return out;
}
