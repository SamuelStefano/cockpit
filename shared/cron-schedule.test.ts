import { describe, it, expect } from 'vitest';
import type { Cron, CronSchedule } from './protocol';
import { scheduleLabel, nextRunAt, isDue, scheduleValid, midnightInTz } from './cron-schedule';

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

describe('scheduleValid', () => {
  it('aceita os três kinds bem-formados', () => {
    expect(scheduleValid({ kind: 'interval', everyMinutes: 60 })).toBe(true);
    expect(scheduleValid({ kind: 'daily', atMinute: 0 })).toBe(true);
    expect(scheduleValid({ kind: 'once', atMs: NOON })).toBe(true);
  });
  it('rejeita kind desconhecido e campo faltando ou não-numérico', () => {
    expect(scheduleValid(undefined)).toBe(false);
    expect(scheduleValid({ kind: 'evil' } as unknown as CronSchedule)).toBe(false);
    expect(scheduleValid({ kind: 'once' })).toBe(false);
    expect(scheduleValid({ kind: 'once', atMs: 'amanhã' as unknown as number })).toBe(false);
    expect(scheduleValid({ kind: 'daily' })).toBe(false);
  });
});

describe('Brasília anchoring', () => {
  const at = (iso: string) => new Date(iso).getTime();
  const daily = (atMinute: number, over: Partial<Cron> = {}): Cron => ({ ...base, schedule: { kind: 'daily', atMinute }, ...over });

  it('midnight is 03:00 UTC, including late evening in Brasília', () => {
    expect(midnightInTz(at('2026-09-10T12:00:00Z'))).toBe(at('2026-09-10T03:00:00Z'));
    expect(midnightInTz(at('2026-09-11T02:30:00Z'))).toBe(at('2026-09-10T03:00:00Z'));
  });
  it('the next 07:00 run from 05:00 BRT is 10:00 UTC the same day', () => {
    expect(nextRunAt(daily(7 * 60), at('2026-09-10T08:00:00Z'))).toBe(at('2026-09-10T10:00:00Z'));
  });
  it('a 01:00 BRT cron after 23:30 BRT runs at 04:00 UTC, not a day later', () => {
    expect(nextRunAt(daily(60), at('2026-09-10T02:30:00Z'))).toBe(at('2026-09-10T04:00:00Z'));
  });
  it('does not fire twice in the same Brasília day', () => {
    const ran = daily(7 * 60, { lastRun: at('2026-09-10T10:00:05Z') });
    expect(isDue(ran, at('2026-09-11T02:59:00Z'))).toBe(false);
    expect(isDue(ran, at('2026-09-11T10:00:05Z'))).toBe(true);
  });
});
