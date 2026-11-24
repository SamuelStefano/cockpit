import { useCallback } from 'react';
import { neighbors } from './canvas-filter';
import type { ConflictInfo } from './CanvasInspector';
import type { CanvasRoute, CanvasRouteProps } from './useCanvasRoute';

// Stable id lookups the inspector and the kanban read; each depends only on
// the slice it needs so a fresh `r` object doesn't recreate them every render.
export function useCanvasLookups(r: Pick<CanvasRoute, 'merged' | 'byId'>, p: Pick<CanvasRouteProps, 'board'>) {
  const { edges } = r.merged;
  const { byId } = r;
  const { cards } = p.board;
  const linked = useCallback((id: string) => [...neighbors(edges, id)].map((x) => byId.get(x)!).filter(Boolean), [edges, byId]);
  const card = useCallback((id: string) => cards.find((c) => c.id === id), [cards]);
  const node = useCallback((id: string) => byId.get(id), [byId]);
  const conflictsOf = useCallback((id: string): ConflictInfo[] => edges
    .filter((e) => e.kind === 'conflict' && (e.source === id || e.target === id))
    .map((e) => ({ other: byId.get(e.source === id ? e.target : e.source), files: e.files ?? [] }))
    .filter((c): c is ConflictInfo => !!c.other), [edges, byId]);
  const sessionNodeOf = useCallback((sessionId: string) => {
    const n = byId.get(`s:${sessionId}`);
    return n ? { title: n.title, subtitle: n.subtitle } : undefined;
  }, [byId]);
  return { linked, card, node, conflictsOf, sessionNodeOf };
}
