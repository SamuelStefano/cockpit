import { describe, it, expect } from 'vitest';
import { mapPlanUsage } from './usage-plan';

describe('mapPlanUsage', () => {
  it('maps the live shape from /api/oauth/usage', () => {
    const u = mapPlanUsage({
      five_hour: { utilization: 54.0, resets_at: '2026-06-07T04:50:00.702863+00:00' },
      seven_day: { utilization: 1.0, resets_at: '2026-06-09T03:00:00.000000+00:00' },
    });
    expect(u.fiveHour).toBe(54);
    expect(u.sevenDay).toBe(1);
    expect(u.resetsAt).toBe(Date.parse('2026-06-07T04:50:00.702863+00:00'));
    expect(u.sevenDayResetsAt).toBe(Date.parse('2026-06-09T03:00:00.000000+00:00'));
  });

  it('rounds and clamps utilization to 0..100', () => {
    expect(mapPlanUsage({ five_hour: { utilization: 47.6 } }).fiveHour).toBe(48);
    expect(mapPlanUsage({ five_hour: { utilization: -5 } }).fiveHour).toBe(0);
    expect(mapPlanUsage({ five_hour: { utilization: 250 } }).fiveHour).toBe(100);
  });

  it('defaults missing fields safely', () => {
    const empty = { fiveHour: 0, sevenDay: 0, resetsAt: null, sevenDayResetsAt: null, limits: [] };
    expect(mapPlanUsage({})).toEqual(empty);
    expect(mapPlanUsage(null)).toEqual(empty);
  });

  it('returns null resetsAt for an unparseable date', () => {
    expect(mapPlanUsage({ five_hour: { resets_at: 'not-a-date' } }).resetsAt).toBeNull();
  });

  it('names a model-scoped weekly limit by its display_name', () => {
    const u = mapPlanUsage({
      limits: [
        { kind: 'session', percent: 19, severity: 'normal', resets_at: '2026-07-31T23:20:00Z' },
        { kind: 'weekly_all', percent: 76, severity: 'warning', resets_at: '2026-08-02T03:00:00Z' },
        { kind: 'weekly_scoped', percent: 0, severity: 'normal', scope: { model: { display_name: 'Fable' } } },
      ],
    });
    expect(u.limits.map((l) => l.label)).toEqual(['Sessão (5h)', 'Semanal', 'Fable']);
    expect(u.limits[1].severity).toBe('warning');
    expect(u.limits[2].scoped).toBe(true);
    expect(u.limits[0].scoped).toBe(false);
  });

  it('survives a limits payload that is not a list or has junk entries', () => {
    expect(mapPlanUsage({ limits: 'nope' }).limits).toEqual([]);
    const u = mapPlanUsage({ limits: [null, { kind: 'weekly_scoped', scope: { model: null } }] });
    expect(u.limits).toHaveLength(2);
    expect(u.limits[0].label).toBe('Limite');
    expect(u.limits[1].label).toBe('Semanal');
  });
});
