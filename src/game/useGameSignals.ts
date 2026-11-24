import { useEffect, useRef } from 'react';
import type { CanvasCard } from '../../shared/canvas';
import { recordGameEvent } from './game-bus';
import { cardStatuses, newlyDone, type CardStatusMap } from './real-events';

// Route changes and palette opens live in App state, not in useCockpit.
// `cards` is the Kanban board already held by the cockpit: diffing it here adds no render.
export function useGameSignals(route: string, paletteOpen: boolean, cards?: readonly CanvasCard[]): void {
  useEffect(() => { recordGameEvent({ type: 'route_visit', route }); }, [route]);
  useEffect(() => { if (paletteOpen) recordGameEvent({ type: 'palette_open' }); }, [paletteOpen]);
  const seen = useRef<CardStatusMap | null>(null);
  useEffect(() => {
    if (!cards || !cards.length) return;
    for (const c of newlyDone(seen.current, cards)) recordGameEvent({ type: 'task_done', key: c.id });
    seen.current = cardStatuses(cards);
  }, [cards]);
}
