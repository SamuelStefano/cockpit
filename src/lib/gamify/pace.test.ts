import { describe, it, expect } from 'vitest';
import { paceOf } from './pace';
import type { PlanUsage } from '../../../shared/protocol';

const DAY = 24 * 3600_000;
const usage = (sevenDay: number, resetsIn: number, now: number): PlanUsage => ({ fiveHour: 10, sevenDay, resetsAt: null, sevenDayResetsAt: now + resetsIn, limits: [] });

describe('paceOf', () => {
  const now = 1_000_000_000_000;

  it('puts the ideal line at the elapsed fraction of the week', () => {
    expect(paceOf(usage(30, 3.5 * DAY, now), now)?.ideal).toBe(50);
  });

  it('says below, above and on pace', () => {
    expect(paceOf(usage(48, 3.5 * DAY, now), now)?.sentence).toBe('2% abaixo do ritmo ideal');
    expect(paceOf(usage(60, 3.5 * DAY, now), now)?.sentence).toBe('10% acima do ritmo ideal');
    expect(paceOf(usage(50, 3.5 * DAY, now), now)?.sentence).toBe('No ritmo ideal da semana');
  });

  it('gives nothing without a usable reset', () => {
    expect(paceOf(null, now)).toBeNull();
    expect(paceOf(usage(10, -1, now), now)).toBeNull();
    expect(paceOf(usage(10, 9 * DAY, now), now)).toBeNull();
  });
});
