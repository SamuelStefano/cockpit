import type { PlanUsage } from '../../../shared/protocol';

const WEEK_MS = 7 * 24 * 3600_000;

export interface Pace {
  // Where the weekly window would be if usage were spread evenly: elapsed fraction of the 7 days, 0..100.
  ideal: number;
  // Positive = ahead of (above) the ideal line.
  delta: number;
  sentence: string;
}

export function paceOf(usage: PlanUsage | null, now: number): Pace | null {
  if (!usage || !usage.sevenDayResetsAt) return null;
  const left = usage.sevenDayResetsAt - now;
  if (left <= 0 || left > WEEK_MS) return null;
  const ideal = Math.round(((WEEK_MS - left) / WEEK_MS) * 100);
  const delta = Math.round(usage.sevenDay - ideal);
  const sentence = delta === 0 ? 'No ritmo ideal da semana'
    : delta < 0 ? `${-delta}% abaixo do ritmo ideal` : `${delta}% acima do ritmo ideal`;
  return { ideal, delta, sentence };
}
