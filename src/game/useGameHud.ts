import { useGameEnabled, useGameState } from './useGameState';
import { level, type LevelInfo } from './engine';

export function useGameHud(): { enabled: boolean; info: LevelInfo; streak: number; xp: number } {
  const enabled = useGameEnabled();
  const state = useGameState();
  return { enabled, info: level(state.xp), streak: state.streak.current, xp: state.xp };
}
