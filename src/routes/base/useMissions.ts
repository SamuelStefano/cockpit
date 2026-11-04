import { useCallback, useMemo } from 'react';
import { moveCard } from '../canvas/canvas-board';
import { buildMissions, type Mission } from './missions';
import type { LiveSource } from './useLiveFeed';

// Missions come from the kanban board the cockpit already keeps in sync over the
// canvas websocket (LiveSource.board); completing one goes through the same
// optimistic card-save + moveCard path the kanban uses.
export function useMissions(source: Pick<LiveSource, 'board' | 'onCanvasCardSave'>): {
  missions: Mission[];
  completeMission: (id: string) => boolean;
} {
  const { board, onCanvasCardSave } = source;
  const missions = useMemo(() => buildMissions(board.cards, Date.now()), [board.cards]);
  const completeMission = useCallback((id: string): boolean => {
    const card = board.cards.find((c) => c.id === id);
    if (!card || !onCanvasCardSave) return false;
    onCanvasCardSave(moveCard(card, 'done', Date.now()));
    return true;
  }, [board.cards, onCanvasCardSave]);
  return { missions, completeMission };
}
