import { gameEnabled, getGameState, recordGameEvent } from './game-bus';

// Records an easter egg; the unlock itself surfaces as the reward pill. Returns
// whether this was the first find.
export function foundEgg(id: string): boolean {
  try {
    if (!gameEnabled()) return false;
    const first = !getGameState().eggs.includes(id);
    recordGameEvent({ type: 'egg_found', egg: id });
    return first;
  } catch {
    return false;
  }
}
