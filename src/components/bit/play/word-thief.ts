export const WORD_IDLE_MS = 25_000;
export const WORD_COOLDOWN_MS = 150_000;
// Typing in the composer counts as "in use" for this long after the last key.
export const WORD_TYPING_MS = 8_000;
// Smaller pointer jitter is not the user coming back.
export const WORD_MOVE_PX = 6;

export interface WordThiefContext {
  now: number;
  lastMove: number;
  // A real mouse has moved at least once; touch-only sessions never trigger this.
  mouseSeen: boolean;
  hidden: boolean;
  selectionActive: boolean;
  composerFocused: boolean;
  lastKey: number;
  lastEnd: number;
  stageBusy: boolean;
  turnRunning: boolean;
  allowed: boolean;
}

// Pure gate for the idle-mouse word thief; the hook polls it.
export function wordThiefReady(c: WordThiefContext): boolean {
  if (!c.allowed || !c.mouseSeen || c.hidden || c.stageBusy || c.turnRunning || c.selectionActive) return false;
  if (c.composerFocused && c.now - c.lastKey < WORD_TYPING_MS) return false;
  if (c.now - c.lastMove < WORD_IDLE_MS) return false;
  if (c.now - c.lastKey < WORD_TYPING_MS) return false;
  return c.now - c.lastEnd >= WORD_COOLDOWN_MS;
}

export const movedEnough = (dx: number, dy: number): boolean => Math.hypot(dx, dy) >= WORD_MOVE_PX;
