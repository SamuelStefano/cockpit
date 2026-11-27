import type { WsRepoStatus } from '../../../shared/protocol';
import { ago } from '../equipe-home/team-home';

// "demo/deck-agents · a1b2c3 · há 2 h" or "Só local".
export function wsStatusLine(s: WsRepoStatus | null, now: number): string {
  if (!s?.repo) return s?.head ? `Só local · ${s.head}` : 'Só local';
  return [s.repo, s.head, s.at ? ago(now - s.at) : undefined, s.pending ? 'push pendente' : undefined].filter(Boolean).join(' · ');
}
