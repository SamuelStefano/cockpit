// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Cron } from '../../../../shared/protocol';
import { buildRoutine, useRotinas } from './useRotinas';

const cron = (id: string, botId?: string, over: Partial<Cron> = {}): Cron => ({ id, name: id, prompt: 'p', schedule: { kind: 'interval', everyMinutes: 10 }, enabled: true, createdAt: 0, botId, ...over });
const input = { botId: 'g', prompt: '  Revisar o calendário. Depois posts.  ', schedule: { kind: 'daily' as const, atMinute: 480, weekdays: [1] }, retry: false };

describe('buildRoutine', () => {
  it('a new routine is owned by the agent, named from the prompt, without model or mode', () => {
    expect(buildRoutine(input, undefined, 42, 'r1')).toEqual({
      id: 'r1', name: 'Revisar o calendário', prompt: 'Revisar o calendário. Depois posts.', schedule: input.schedule, enabled: true, createdAt: 42, botId: 'g',
    });
  });
  it('retry is only written when on', () => {
    expect(buildRoutine({ ...input, retry: true }, undefined, 1, 'r').retry).toBe(true);
    expect('retry' in buildRoutine(input, undefined, 1, 'r')).toBe(false);
  });
  it('editing keeps id, name, enabled and drops retry when switched off', () => {
    const old = cron('r9', 'g', { name: 'Meu nome', enabled: false, retry: true, lastRun: 5 });
    const out = buildRoutine(input, old, 99);
    expect(out).toMatchObject({ id: 'r9', name: 'Meu nome', enabled: false, createdAt: 0, lastRun: 5, schedule: input.schedule });
    expect('retry' in out).toBe(false);
  });
});

describe('useRotinas', () => {
  const setup = (botId?: string) => {
    const api = { onCronsGet: vi.fn(), onCronSave: vi.fn(), onCronDelete: vi.fn(), onCronRun: vi.fn() };
    const hook = renderHook(() => useRotinas({ crons: [cron('a', 'g'), cron('b'), cron('c', 'l')], bots: [], connected: true, botId, ...api }));
    return { api, hook };
  };
  it('loads crons and scopes to one agent when asked', () => {
    const all = setup();
    expect(all.api.onCronsGet).toHaveBeenCalled();
    expect(all.hook.result.current.routines.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(setup('g').hook.result.current.routines.map((c) => c.id)).toEqual(['a']);
  });
  it('toggle, run and remove go through the cron frames', () => {
    const { api, hook } = setup();
    act(() => hook.result.current.toggle(hook.result.current.routines[0]));
    expect(api.onCronSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', enabled: false }));
    hook.result.current.run('a');
    hook.result.current.remove('a');
    expect(api.onCronRun).toHaveBeenCalledWith('a');
    expect(api.onCronDelete).toHaveBeenCalledWith('a');
  });
  it('save sends the built routine and closes the modal', () => {
    const { api, hook } = setup();
    act(() => hook.result.current.openNew());
    expect(hook.result.current.modal).toEqual({});
    act(() => hook.result.current.save(input));
    expect(api.onCronSave).toHaveBeenCalledWith(expect.objectContaining({ botId: 'g', enabled: true, schedule: input.schedule }));
    expect(hook.result.current.modal).toBeNull();
  });
  it('turning on a past one-shot opens the editor instead of saving', () => {
    const api = { onCronsGet: vi.fn(), onCronSave: vi.fn(), onCronDelete: vi.fn(), onCronRun: vi.fn() };
    const past = cron('o', 'g', { enabled: false, schedule: { kind: 'once', atMs: 1 } });
    const { result } = renderHook(() => useRotinas({ crons: [past], bots: [], connected: true, ...api }));
    act(() => result.current.toggle(past));
    expect(api.onCronSave).not.toHaveBeenCalled();
    expect(result.current.modal).toEqual({ editing: past });
  });
});
