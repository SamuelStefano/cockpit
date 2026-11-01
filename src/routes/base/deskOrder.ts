import type { FloorAgent, Wing } from './types';

// Stable walk order: wing order on the floor, then position inside the wing (x, then z).
// Never the array order, which follows session recency and reshuffles between polls.
export function orderDesks(agents: FloorAgent[], wings: Pick<Wing, 'id'>[]): FloorAgent[] {
  const rank = new Map(wings.map((w, i) => [w.id, i]));
  const wingRank = (a: FloorAgent) => rank.get(a.wingId) ?? wings.length;
  return [...agents].sort((a, b) => wingRank(a) - wingRank(b) || a.x - b.x || a.z - b.z || a.id.localeCompare(b.id));
}

export function stepDesk(ordered: { id: string }[], currentId: string | null, dir: 1 | -1): string | null {
  if (!ordered.length) return null;
  const i = ordered.findIndex((a) => a.id === currentId);
  if (i < 0) return ordered[dir > 0 ? 0 : ordered.length - 1].id;
  return ordered[(i + dir + ordered.length) % ordered.length].id;
}
