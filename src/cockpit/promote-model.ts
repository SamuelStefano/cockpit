import type { ModelInfo } from '../../shared/protocol';
import { isAgentModel } from '../../shared/agents';

// An agent pin is never rewritten: the agent can be briefly absent from the list
// (not yet tested, CLI restarting) and silently swapping it for sonnet would move
// the chat to a different engine.
export function promoteModel(list: ModelInfo[], cur: string): string {
  if (isAgentModel(cur)) return cur;
  if (list.some((m) => m.id === cur)) return cur;
  const upgrade = ['opus', 'sonnet', 'haiku'].includes(cur)
    ? list.find((m) => m.id.includes(cur))
    : (list.find((m) => m.id.includes('sonnet')) ?? list[0]);
  return upgrade ? upgrade.id : cur;
}
