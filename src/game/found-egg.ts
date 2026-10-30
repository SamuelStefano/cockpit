import { toast } from '../components/primitives/toast-bus';
import { gameEnabled, getGameState, recordGameEvent } from './game-bus';

// Records an easter egg and, only the first time it is ever found, shows a
// discreet toast. Returns whether this was the first find.
export function foundEgg(id: string, firstMessage?: string): boolean {
  try {
    if (!gameEnabled()) return false;
    const first = !getGameState().eggs.includes(id);
    if (first && firstMessage) toast(firstMessage, { durationMs: 4000 });
    recordGameEvent({ type: 'egg_found', egg: id });
    return first;
  } catch {
    return false;
  }
}
