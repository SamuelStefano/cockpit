import type { PointsHistoryItem } from '../../../shared/protocol';

// Rótulo curto de um evento do histórico pra timeline.
export function kindLabel(k: PointsHistoryItem['kind']): string {
  switch (k) {
    case 'create': return 'registrou';
    case 'correct': return 'corrigiu';
    case 'note': return 'anotou';
    case 'delete': return 'excluiu';
  }
}

// History spans days: a bare "14:05" could be today or last week.
export function whenShort(ts: number, now: number): string {
  const d = new Date(ts);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) return hhmm(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hhmm(ts)}`;
}

export function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
