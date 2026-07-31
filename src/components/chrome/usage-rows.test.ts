import { describe, it, expect } from 'vitest';
import { toneOf, usageRows } from './usage-rows';
import type { PlanUsage } from '../../../shared/protocol';

const base: PlanUsage = { fiveHour: 19, sevenDay: 76, resetsAt: 1000, sevenDayResetsAt: 2000, limits: [] };

describe('toneOf', () => {
  it('escalates by percentage', () => {
    expect(toneOf(0)).toBe('ok');
    expect(toneOf(69)).toBe('ok');
    expect(toneOf(70)).toBe('mid');
    expect(toneOf(89)).toBe('mid');
    expect(toneOf(90)).toBe('high');
  });

  it('escalates by the severity the account reports, even at a low percentage', () => {
    expect(toneOf(5, 'warning')).toBe('mid');
    expect(toneOf(5, 'critical')).toBe('high');
  });

  it('never de-escalates a high percentage that came back as normal', () => {
    expect(toneOf(95, 'normal')).toBe('high');
  });
});

describe('usageRows', () => {
  it('is empty until the first poll lands', () => {
    expect(usageRows(null)).toEqual([]);
  });

  it('falls back to the two loose numbers when the account reports no limits', () => {
    expect(usageRows(base).map((r) => [r.label, r.pct, r.resetsAt])).toEqual([
      ['Sessão (5h)', 19, 1000],
      ['Semanal', 76, 2000],
    ]);
  });

  it('prefers the limits list, which is the only place a model-scoped cap exists', () => {
    const rows = usageRows({
      ...base,
      limits: [
        { id: 'session-0', label: 'Sessão (5h)', pct: 19, resetsAt: 1000, severity: 'normal', scoped: false },
        { id: 'weekly_all-1', label: 'Semanal', pct: 76, resetsAt: 2000, severity: 'warning', scoped: false },
        { id: 'weekly_scoped-2', label: 'Fable', pct: 0, resetsAt: null, severity: 'normal', scoped: true },
      ],
    });
    expect(rows.map((r) => r.label)).toEqual(['Sessão (5h)', 'Semanal', 'Fable']);
    expect(rows[1].tone).toBe('mid');
    expect(rows[2].scoped).toBe(true);
  });
});
