import { describe, it, expect } from 'vitest';
import { buildSchedule, draftValid, toLocalInput, type CronDraft } from './useCronForm';

const draft = (over: Partial<CronDraft>): CronDraft => ({
  name: 'n', prompt: 'p', kind: 'daily', everyMinutes: 60, time: '09:00',
  at: '2026-07-25T09:59', model: '', mode: 'plan', effort: 'low', ...over,
});

describe('buildSchedule', () => {
  it('intervalo com piso de 1 min', () => {
    expect(buildSchedule(draft({ kind: 'interval', everyMinutes: 0 }))).toEqual({ kind: 'interval', everyMinutes: 1 });
  });
  it('diário vira minuto do dia', () => {
    expect(buildSchedule(draft({ time: '18:30' }))).toEqual({ kind: 'daily', atMinute: 18 * 60 + 30 });
  });
  it('uma vez vira timestamp local absoluto', () => {
    expect(buildSchedule(draft({ kind: 'once' }))).toEqual({ kind: 'once', atMs: new Date(2026, 6, 25, 9, 59).getTime() });
  });
});

describe('draftValid', () => {
  it('exige nome e prompt', () => {
    expect(draftValid(draft({ name: '  ' }))).toBe(false);
    expect(draftValid(draft({ prompt: '' }))).toBe(false);
  });
  it('uma vez exige data parseável', () => {
    expect(draftValid(draft({ kind: 'once', at: '' }))).toBe(false);
    expect(draftValid(draft({ kind: 'once' }))).toBe(true);
  });
});

describe('toLocalInput', () => {
  it('formata pro input sem fuso e volta no mesmo instante', () => {
    const ts = new Date(2026, 6, 25, 9, 59).getTime();
    expect(toLocalInput(ts)).toBe('2026-07-25T09:59');
    expect(new Date(toLocalInput(ts)).getTime()).toBe(ts);
  });
});
