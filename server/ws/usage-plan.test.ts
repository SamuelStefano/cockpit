import { describe, it, expect } from 'vitest';
import { mapPlanUsage } from './usage-plan';

describe('mapPlanUsage', () => {
  it('maps the live shape from /api/oauth/usage', () => {
    const u = mapPlanUsage({
      five_hour: { utilization: 54.0, resets_at: '2026-06-07T04:50:00.702863+00:00' },
      seven_day: { utilization: 1.0 },
    });
    expect(u.fiveHour).toBe(54);
    expect(u.sevenDay).toBe(1);
    expect(u.resetsAt).toBe(Date.parse('2026-06-07T04:50:00.702863+00:00'));
  });

  it('rounds and clamps utilization to 0..100', () => {
    expect(mapPlanUsage({ five_hour: { utilization: 47.6 } }).fiveHour).toBe(48);
    expect(mapPlanUsage({ five_hour: { utilization: -5 } }).fiveHour).toBe(0);
    expect(mapPlanUsage({ five_hour: { utilization: 250 } }).fiveHour).toBe(100);
  });

  it('defaults missing fields safely', () => {
    const u = mapPlanUsage({});
    expect(u).toEqual({ fiveHour: 0, sevenDay: 0, resetsAt: null, windows: [] });
    expect(mapPlanUsage(null)).toEqual({ fiveHour: 0, sevenDay: 0, resetsAt: null, windows: [] });
  });

  it('returns null resetsAt for an unparseable date', () => {
    expect(mapPlanUsage({ five_hour: { resets_at: 'not-a-date' } }).resetsAt).toBeNull();
  });

  it('lista as janelas na ordem canônica, com reset de cada uma', () => {
    const u = mapPlanUsage({
      seven_day_opus: { utilization: 71.2, resets_at: '2026-06-12T00:00:00Z' },
      five_hour: { utilization: 54, resets_at: '2026-06-07T04:50:00Z' },
      seven_day: { utilization: 33 },
    });
    expect(u.windows).toEqual([
      { key: 'five_hour', pct: 54, resetsAt: Date.parse('2026-06-07T04:50:00Z') },
      { key: 'seven_day', pct: 33, resetsAt: null },
      { key: 'seven_day_opus', pct: 71, resetsAt: Date.parse('2026-06-12T00:00:00Z') },
    ]);
  });

  it('omite janela que a conta não expõe em vez de mostrar 0%', () => {
    const u = mapPlanUsage({ five_hour: { utilization: 10 }, seven_day: { utilization: 2 }, seven_day_opus: {} });
    expect(u.windows.map((w) => w.key)).toEqual(['five_hour', 'seven_day']);
  });
});
