export type MascotState = 'idle' | 'thinking' | 'working' | 'waiting' | 'blocked' | 'done';

export const MASCOT_STATES: MascotState[] = ['idle', 'thinking', 'working', 'waiting', 'blocked', 'done'];

export const MASCOT_STATE_LABEL: Record<MascotState, string> = {
  idle: 'à toa',
  thinking: 'pensando',
  working: 'trabalhando',
  waiting: 'esperando você',
  blocked: 'travado',
  done: 'terminou',
};

// How long the happy "done" face lingers after a clean turn before going idle.
export const DONE_MS = 90_000;

export interface MascotSignals {
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
export function deriveMascotState(s: MascotSignals): MascotState {
  if (s.running) return s.phase === 'thinking' ? 'thinking' : 'working';
  if (s.waiting) return 'waiting';
  if (s.failed) return 'blocked';
  if (s.lastTurnOk && s.endedAt !== undefined && s.now - s.endedAt < DONE_MS) return 'done';
  return 'idle';
}

// When a "done" face should flip back to idle, so a hook can schedule one timer
// instead of polling the clock.
export function msUntilIdle(s: MascotSignals): number | null {
  if (deriveMascotState(s) !== 'done' || s.endedAt === undefined) return null;
  return Math.max(0, DONE_MS - (s.now - s.endedAt));
}
