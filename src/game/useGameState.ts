import { useEffect, useState } from 'react';
import { usePersisted } from '../lib/persist';
import { GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT } from '../lib/prefs';
import { getGameState, subscribeGame } from './game-bus';
import type { GameState } from './types';

export function useGameEnabled(): boolean {
  return usePersisted<boolean>(GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT)[0];
}

export function useGameState(): GameState {
  const [state, setState] = useState<GameState>(getGameState);
  useEffect(() => {
    setState(getGameState());
    return subscribeGame(setState);
  }, []);
  return state;
}
