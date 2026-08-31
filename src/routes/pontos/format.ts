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

export function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
