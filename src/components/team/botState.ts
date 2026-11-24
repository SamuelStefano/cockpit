export type BotState = 'idle' | 'thinking' | 'working' | 'waiting' | 'error' | 'done';

export const BOT_STATES: BotState[] = ['idle', 'thinking', 'working', 'waiting', 'error', 'done'];

export const BOT_STATE_LABEL: Record<BotState, string> = {
  idle: 'à toa',
  thinking: 'pensando',
  working: 'trabalhando',
  waiting: 'esperando você',
  error: 'travou',
  done: 'terminou',
};

// How long the happy "done" face lingers after a clean turn before going idle.
export const DONE_MS = 90_000;

export interface BotSignals {
  running: boolean;
  phase?: 'idle' | 'thinking' | 'streaming';
  waiting?: boolean;
  failed?: boolean;
  lastTurnOk?: boolean;
  endedAt?: number;
  now: number;
}

// Order matters: a live turn outranks the leftovers of the previous one (a turn
// that failed and was re-sent is working again, not blocked).
export function deriveBotState(s: BotSignals): BotState {
  if (s.running) return s.phase === 'thinking' ? 'thinking' : 'working';
  if (s.waiting) return 'waiting';
  if (s.failed) return 'error';
  if (s.lastTurnOk && s.endedAt !== undefined && s.now - s.endedAt < DONE_MS) return 'done';
  return 'idle';
}

// When a "done" face should flip back to idle, so a hook can schedule one timer
// instead of polling the clock.
export function msUntilIdle(s: BotSignals): number | null {
  if (deriveBotState(s) !== 'done' || s.endedAt === undefined) return null;
  return Math.max(0, DONE_MS - (s.now - s.endedAt));
}
