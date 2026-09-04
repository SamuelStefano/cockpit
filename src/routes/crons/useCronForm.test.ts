// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { buildSchedule, draftValid, enabledFor, toLocalInput, useCronForm, type CronDraft } from './useCronForm';
import type { Cron } from '../../../shared/protocol';

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

describe('enabledFor', () => {
  const NOW = new Date(2026, 6, 25, 12, 0).getTime();
  const fired: Cron = { id: 'o', name: 'n', prompt: 'p', schedule: { kind: 'once', atMs: NOW - 60_000 },
    enabled: false, createdAt: 0, lastRun: NOW - 60_000 };

  it('remarcar um "uma vez" já disparado pra frente re-arma', () => {
    expect(enabledFor({ kind: 'once', atMs: NOW + 60_000 }, fired, NOW)).toBe(true);
  });
  it('"uma vez" no passado nasce pausado', () => {
    expect(enabledFor({ kind: 'once', atMs: NOW - 1 }, null, NOW)).toBe(false);
  });
  it('recorrente preserva o enabled do original', () => {
    expect(enabledFor({ kind: 'daily', atMinute: 540 }, { ...fired, enabled: false }, NOW)).toBe(false);
    expect(enabledFor({ kind: 'daily', atMinute: 540 }, null, NOW)).toBe(true);
  });
});

describe('toLocalInput', () => {
  it('formata pro input sem fuso e volta no mesmo instante', () => {
    const ts = new Date(2026, 6, 25, 9, 59).getTime();
    expect(toLocalInput(ts)).toBe('2026-07-25T09:59');
    expect(new Date(toLocalInput(ts)).getTime()).toBe(ts);
  });
});

describe('applyResetPreset', () => {
  // O preset só faz sentido como one-shot: se o kind não trocasse junto, o usuário
  // clicava, via a data certa no campo, e salvava um cron 'daily' que ignora o atMs.
  it('troca o kind pra once junto com a data', () => {
    const { result } = renderHook(() => useCronForm(() => {}));
    act(() => result.current.set('kind', 'daily'));
    const at = new Date('2026-09-04T23:30:00').getTime();
    act(() => result.current.applyResetPreset(at));
    expect(result.current.draft.kind).toBe('once');
    expect(buildSchedule(result.current.draft)).toEqual({ kind: 'once', atMs: at });
  });
});
