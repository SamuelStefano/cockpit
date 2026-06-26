import { describe, it, expect } from 'vitest';
import type { Cron } from './protocol';
import { scheduleLabel, nextRunAt, isDue } from './cron-schedule';

const base: Cron = { id: 'x', name: 'n', prompt: 'p', schedule: { kind: 'interval', everyMinutes: 60 }, enabled: true, createdAt: 0 };
const NOON = new Date('2026-06-25T12:00:00').getTime();

describe('scheduleLabel', () => {
  it('formata intervalo em horas quando múltiplo de 60', () => {
    expect(scheduleLabel({ kind: 'interval', everyMinutes: 120 })).toBe('a cada 2h');
    expect(scheduleLabel({ kind: 'interval', everyMinutes: 45 })).toBe('a cada 45min');
  });
  it('formata diário em HH:MM', () => {
    expect(scheduleLabel({ kind: 'daily', atMinute: 9 * 60 + 5 })).toBe('todo dia 09:05');
  });
});

describe('nextRunAt', () => {
  it('intervalo: último + N min', () => {
    const c = { ...base, lastRun: NOON, schedule: { kind: 'interval' as const, everyMinutes: 30 } };
    expect(nextRunAt(c, NOON)).toBe(NOON + 30 * 60_000);
  });
  it('diário: hoje se ainda não passou, senão amanhã', () => {
    const future = { ...base, schedule: { kind: 'daily' as const, atMinute: 18 * 60 } };
    expect(nextRunAt(future, NOON)).toBeGreaterThan(NOON);
    const past = { ...base, schedule: { kind: 'daily' as const, atMinute: 8 * 60 } };
    expect(nextRunAt(past, NOON)).toBeGreaterThan(NOON);
  });
});

describe('isDue', () => {
  it('nunca dispara se pausado', () => {
    expect(isDue({ ...base, enabled: false, lastRun: 0 }, NOON)).toBe(false);
  });
  it('intervalo vencido dispara', () => {
    expect(isDue({ ...base, lastRun: NOON - 2 * 3_600_000 }, NOON)).toBe(true);
    expect(isDue({ ...base, lastRun: NOON - 10_000 }, NOON)).toBe(false);
  });
});
