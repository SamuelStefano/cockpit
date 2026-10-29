import { meterTone } from '../status-bar-format';

export const LIFE_PULSE_PCT = 85;

export interface LifeBar {
  pct: number;
  color: string;
  pulse: boolean;
}

// The chat's "life bar": how full the context window is, as width plus tone.
export function lifeBar(pct: number | null | undefined): LifeBar | null {
  if (pct === null || pct === undefined || pct <= 0) return null;
  const clamped = Math.min(100, pct);
  return { pct: clamped, color: meterTone(clamped), pulse: clamped >= LIFE_PULSE_PCT };
}
