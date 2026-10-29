import { loadPref } from './persist';
import { HAPTICS_KEY, HAPTICS_DEFAULT } from './prefs';

export type HapticKind = 'tap' | 'done' | 'error';

const PATTERNS: Record<HapticKind, number[]> = {
  tap: [10],
  done: [30],
  error: [60, 40, 60],
};

export function haptic(kind: HapticKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return;
  if (!loadPref<boolean>(HAPTICS_KEY, HAPTICS_DEFAULT)) return;
  try { navigator.vibrate(PATTERNS[kind]); } catch { /* best-effort */ }
}
