import type { AgentConfig } from '../../shared/agents';
import { recordSnapshot } from './snapshots';

export const agentContent = (a: AgentConfig): string => JSON.stringify(a, null, 2);

export async function recordAgentChanges(before: AgentConfig[], after: AgentConfig[], note?: string): Promise<void> {
  const prev = new Map(before.map((a) => [a.id, agentContent(a)]));
  const next = new Map(after.map((a) => [a.id, agentContent(a)]));
  for (const [id, content] of next) {
    if (prev.get(id) === content) continue;
    const old = prev.get(id);
    if (old !== undefined) await recordSnapshot('agent', id, old);
    await recordSnapshot('agent', id, content, note);
  }
  for (const [id, content] of prev) {
    if (next.has(id)) continue;
    await recordSnapshot('agent', id, content);
    await recordSnapshot('agent', id, null);
  }
}
