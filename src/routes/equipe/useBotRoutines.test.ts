// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Cron } from '../../../shared/protocol';
import { buildRoutine, emptyRoutineDraft, routineDraftError, useBotRoutines } from './useBotRoutines';

const cron = (id: string, botId?: string): Cron => ({ id, name: id, prompt: 'p', schedule: { kind: 'interval', everyMinutes: 10 }, enabled: true, createdAt: 0, botId });

describe('routine draft', () => {
  const ok = { ...emptyRoutineDraft(), name: 'métricas', prompt: 'puxe as métricas' };
  it('requires a name, a prompt and the 5-minute floor', () => {
    expect(routineDraftError(emptyRoutineDraft())).toMatch(/nome/);
    expect(routineDraftError({ ...ok, prompt: ' ' })).toMatch(/o que o bot deve fazer/);
    expect(routineDraftError({ ...ok, everyMinutes: 4 })).toMatch(/mínimo é 5 min/);
    expect(routineDraftError({ ...ok, everyMinutes: 5 })).toBeNull();
    expect(routineDraftError({ ...ok, kind: 'daily', everyMinutes: 0 })).toBeNull();
  });
  it('builds a routine owned by the bot, without its own model or mode', () => {
    const c = buildRoutine('capo1', { ...ok, kind: 'daily', time: '07:30' }, 42, 'r1');
    expect(c).toEqual({ id: 'r1', name: 'métricas', prompt: 'puxe as métricas', schedule: { kind: 'daily', atMinute: 450 }, enabled: true, createdAt: 42, botId: 'capo1' });
  });
});

describe('useBotRoutines', () => {
  const setup = () => {
    const api = { onCronsGet: vi.fn(), onCronSave: vi.fn(), onCronDelete: vi.fn(), onCronRun: vi.fn() };
    const hook = renderHook(() => useBotRoutines({ botId: 'capo1', crons: [cron('a', 'capo1'), cron('b'), cron('c', 'lead1')], connected: true, ...api }));
    return { api, hook };
  };

  it('loads the crons and lists only this bot routines', () => {
    const { api, hook } = setup();
    expect(api.onCronsGet).toHaveBeenCalled();
    expect(hook.result.current.routines.map((c) => c.id)).toEqual(['a']);
  });

  it('toggles, runs and deletes through the cron frames', () => {
    const { api, hook } = setup();
    act(() => hook.result.current.toggle(hook.result.current.routines[0]));
    expect(api.onCronSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', enabled: false, botId: 'capo1' }));
    hook.result.current.run('a');
    hook.result.current.remove('a');
    expect(api.onCronRun).toHaveBeenCalledWith('a');
    expect(api.onCronDelete).toHaveBeenCalledWith('a');
  });

  it('creates a routine only once the draft is valid', () => {
    const { api, hook } = setup();
    act(() => hook.result.current.open());
    act(() => hook.result.current.submit());
    expect(api.onCronSave).not.toHaveBeenCalled();
    act(() => { hook.result.current.set('name', 'métricas'); hook.result.current.set('prompt', 'puxe'); hook.result.current.set('everyMinutes', 5); });
    act(() => hook.result.current.submit());
    expect(api.onCronSave).toHaveBeenCalledWith(expect.objectContaining({ botId: 'capo1', schedule: { kind: 'interval', everyMinutes: 5 } }));
    expect(hook.result.current.draft).toBeNull();
  });
});
