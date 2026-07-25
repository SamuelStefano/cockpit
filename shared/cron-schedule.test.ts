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
  it('formata uma vez com data e hora', () => {
    expect(scheduleLabel({ kind: 'once', atMs: new Date(2026, 6, 25, 9, 59).getTime() })).toBe('uma vez em 25/07 09:59');
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

describe('uma vez', () => {
  const once = (atMs: number, over: Partial<Cron> = {}): Cron => ({ ...base, schedule: { kind: 'once', atMs }, ...over });

  it('nextRunAt é o instante marcado', () => {
    expect(nextRunAt(once(NOON + 60_000), NOON)).toBe(NOON + 60_000);
  });
  it('só dispara depois do instante marcado', () => {
    expect(isDue(once(NOON + 1), NOON)).toBe(false);
    expect(isDue(once(NOON), NOON)).toBe(true);
  });
  it('não repete depois de rodar', () => {
    expect(isDue(once(NOON, { lastRun: NOON }), NOON + 3_600_000)).toBe(false);
  });
  it('reagendar pra frente volta a valer', () => {
    const rescheduled = once(NOON + 3_600_000, { lastRun: NOON });
    expect(isDue(rescheduled, NOON + 3_600_000)).toBe(true);
  });
});
