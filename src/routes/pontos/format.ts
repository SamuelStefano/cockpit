import type { PointsHistoryItem } from '../../../shared/protocol';

// "agora" / "há 5min" / "há 2h" / "há 3d" — determinístico (now passado de fora).
export function relTime(ts: number, now: number): string {
  const ms = now - ts;
  if (ms < 45_000) return 'agora';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

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
