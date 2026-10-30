import { loadPref, savePref } from '../lib/persist';
import { GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT, GAME_STATE_KEY, GAME_RECENT_KEY } from '../lib/prefs';
import { applyEvent, loadState, claimOnce } from './engine';
import type { GameEvent, GameState, Reward } from './types';

type StateListener = (state: GameState) => void;
type RewardListener = (rewards: Reward[], state: GameState) => void;

const stateListeners = new Set<StateListener>();
const rewardListeners = new Set<RewardListener>();
const DEDUPE_MS = 5000;

export const gameEnabled = (): boolean => loadPref(GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT);

// Re-read on every call: another tab may have advanced the same localStorage blob.
export const getGameState = (): GameState => loadState(loadPref<unknown>(GAME_STATE_KEY, null));

function save(state: GameState): void {
  savePref(GAME_STATE_KEY, state);
  for (const l of stateListeners) l(state);
}

// Persisted: a second tab receives the same `done` and must not pay the XP again.
function duplicate(key: string | undefined, now: number): boolean {
  if (!key) return false;
  const recent = loadPref<Record<string, number>>(GAME_RECENT_KEY, {});
  for (const k of Object.keys(recent)) if (now - recent[k] > DEDUPE_MS) delete recent[k];
  const hit = key in recent;
  if (!hit) recent[key] = now;
  savePref(GAME_RECENT_KEY, recent);
  return hit;
}

// Never throws: the game is decoration and must not break a useCockpit code path.
export function recordGameEvent(event: GameEvent, now: Date = new Date()): void {
  try {
    if (!gameEnabled()) return;
    if (duplicate(event.key && `${event.type}:${event.key}`, now.getTime())) return;
    const { state, rewards } = applyEvent(getGameState(), event, now);
    save(state);
    if (rewards.length) for (const l of rewardListeners) l(rewards, state);
  } catch {
    /* best-effort */
  }
}

// True once per `stamp` (a day or a year) for `key`; persisted so a reload does not repeat it.
export function claimGameOnce(key: string, stamp: string): boolean {
  try {
    if (!gameEnabled()) return false;
    const { state, claimed } = claimOnce(getGameState(), key, stamp);
    if (claimed) save(state);
    return claimed;
  } catch {
    return false;
  }
}

export function subscribeGame(fn: StateListener): () => void {
  stateListeners.add(fn);
  return () => { stateListeners.delete(fn); };
}

export function subscribeRewards(fn: RewardListener): () => void {
  rewardListeners.add(fn);
  return () => { rewardListeners.delete(fn); };
}
