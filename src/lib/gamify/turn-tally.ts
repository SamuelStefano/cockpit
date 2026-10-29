export interface TurnTally {
  lastDay: string;
  turnsToday: number;
  streak: number;
  best: number;
}

export const TURN_TALLY_KEY = 'gam.turns';
export const EMPTY_TALLY: TurnTally = { lastDay: '', turnsToday: 0, streak: 0, best: 0 };
export const TURN_MILESTONES = [10, 25, 50];

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function yesterdayKey(ms: number): string {
  const d = new Date(ms);
  d.setDate(d.getDate() - 1);
  return dayKey(d.getTime());
}

// A finished turn: bumps today's count, and the streak when it is the first turn of a new day
// that follows yesterday (a gap restarts it at 1).
export function recordTurn(t: TurnTally, now: number): TurnTally {
  const today = dayKey(now);
  if (t.lastDay === today) return { ...t, turnsToday: t.turnsToday + 1 };
  const streak = t.lastDay === yesterdayKey(now) ? t.streak + 1 : 1;
  return { lastDay: today, turnsToday: 1, streak, best: Math.max(t.best, streak) };
}

// The streak still counts until the day after the last turn ends without another one.
export function liveStreak(t: TurnTally, now: number): number {
  return t.lastDay === dayKey(now) || t.lastDay === yesterdayKey(now) ? t.streak : 0;
}

export function turnsOn(t: TurnTally, now: number): number {
  return t.lastDay === dayKey(now) ? t.turnsToday : 0;
}

export const isMilestone = (turnsToday: number): boolean => TURN_MILESTONES.includes(turnsToday);

export function tallyTitle(streak: number, turns: number): string {
  const days = streak === 1 ? '1 dia seguido' : `${streak} dias seguidos`;
  return `${days} · ${turns} ${turns === 1 ? 'turno' : 'turnos'} hoje`;
}
