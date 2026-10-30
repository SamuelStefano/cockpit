import { useEffect } from 'react';
import { recordGameEvent } from './game-bus';

// Route changes and palette opens live in App state, not in useCockpit.
export function useGameSignals(route: string, paletteOpen: boolean): void {
  useEffect(() => { recordGameEvent({ type: 'route_visit', route }); }, [route]);
  useEffect(() => { if (paletteOpen) recordGameEvent({ type: 'palette_open' }); }, [paletteOpen]);
}
