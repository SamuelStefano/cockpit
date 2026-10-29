import type { Message } from '../../data/types';
import { prLinks } from './coalesce-compacts';

// Unique pull requests announced in a conversation (the 'pr' divider markers). Merged state
// would need the relay, so this counts opened ones.
export function countPrs(messages: Message[]): number {
  const urls = new Set<string>();
  for (const m of messages) {
    if (m.role !== 'compact' || m.kind !== 'pr') continue;
    for (const p of prLinks(m)) if (p.url) urls.add(p.url);
  }
  return urls.size;
}

export function prCountLabel(n: number): string {
  return n === 1 ? '1 PR nesta conversa' : `${n} PRs nesta conversa`;
}
