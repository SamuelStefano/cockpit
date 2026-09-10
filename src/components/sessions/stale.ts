import type { Session } from '../../data/types';

export const IDLE_OPTIONS = [3, 7, 14, 30] as const;
export const FUNNEL_MAX = 20;      // espelha MAX_SESSIONS em server/funnel.ts
export const FUNNEL_MIN_OFFER = 3; // abaixo disso não vale gastar uma destilação

export interface StaleArgs {
  now: number;
  idleDays: number;
  pinned: Set<string>;
  running?: Set<string>;
  activeId?: string;
  max?: number;
}

// Candidatas ao afunilamento: paradas há mais de N dias e sem nenhum sinal de que
// ainda importam. Favorita, rodando, aberta ou esperando resposta ficam de fora —
// arquivar uma delas é justamente o erro que faria o botão perder a confiança.
export function staleSessions(sessions: Session[], a: StaleArgs): Session[] {
  const cut = a.now - a.idleDays * 86_400_000;
  return sessions
    .filter((s) => !s.id.startsWith('new-')
      && s.mtime < cut
      && !s.waiting
      && s.id !== a.activeId
      && !a.pinned.has(s.id)
      && !a.running?.has(s.id))
    .sort((x, y) => x.mtime - y.mtime)
    .slice(0, a.max ?? FUNNEL_MAX);
}

export function idleLabel(mtime: number, now: number): string {
  const days = Math.floor((now - mtime) / 86_400_000);
  if (days >= 30) return `${Math.floor(days / 30)} m`;
  return `${days} d`;
}
