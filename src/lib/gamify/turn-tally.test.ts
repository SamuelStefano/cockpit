import { describe, it, expect } from 'vitest';
import { EMPTY_TALLY, recordTurn, liveStreak, turnsOn, isMilestone, tallyTitle, dayKey } from './turn-tally';

const D = (day: number, h = 12) => new Date(2026, 9, day, h).getTime();

describe('turn tally', () => {
  it('starts a streak of 1 on the first turn and counts the day', () => {
    const t = recordTurn(EMPTY_TALLY, D(10));
    expect(t).toMatchObject({ streak: 1, turnsToday: 1, best: 1 });
    expect(recordTurn(t, D(10, 15))).toMatchObject({ streak: 1, turnsToday: 2 });
  });

  it('extends on the next day and restarts after a gap, keeping the best', () => {
    let t = recordTurn(EMPTY_TALLY, D(10));
    t = recordTurn(t, D(11));
    t = recordTurn(t, D(12));
    expect(t).toMatchObject({ streak: 3, turnsToday: 1, best: 3 });
    t = recordTurn(t, D(15));
    expect(t).toMatchObject({ streak: 1, best: 3 });
  });

  it('keeps the streak alive until the day after the last turn', () => {
    const t = recordTurn(EMPTY_TALLY, D(10));
    expect(liveStreak(t, D(11))).toBe(1);
    expect(liveStreak(t, D(12))).toBe(0);
    expect(turnsOn(t, D(11))).toBe(0);
  });

  it('flags the 10th, 25th and 50th turn of the day', () => {
    expect([9, 10, 25, 26, 50].map(isMilestone)).toEqual([false, true, true, false, true]);
  });

  it('writes the tooltip text', () => {
    expect(tallyTitle(6, 14)).toBe('6 dias seguidos · 14 turnos hoje');
    expect(tallyTitle(1, 1)).toBe('1 dia seguido · 1 turno hoje');
    expect(dayKey(D(3))).toBe('2026-10-03');
  });
});
