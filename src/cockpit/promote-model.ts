import type { ModelInfo } from '../../shared/protocol';
import { isAgentModel } from '../../shared/agents';

// An agent pin is never rewritten: the agent can be briefly absent from the list
// (not yet tested, CLI restarting) and silently swapping it for sonnet would move
// the chat to a different engine.
export function promoteModel(list: ModelInfo[], cur: string): string {
  if (isAgentModel(cur)) return cur;
  if (list.some((m) => m.id === cur)) return cur;
  // Only Claude models are upgrade targets: with no Claude list (no OAuth, API
  // down) the list holds just the agents, and `list[0]` would silently move a
  // Claude chat onto Grok.
  const claude = list.filter((m) => !isAgentModel(m.id));
  const upgrade = ['opus', 'sonnet', 'haiku'].includes(cur)
    ? claude.find((m) => m.id.includes(cur))
    : (claude.find((m) => m.id.includes('sonnet')) ?? claude[0]);
  return upgrade ? upgrade.id : cur;
}
