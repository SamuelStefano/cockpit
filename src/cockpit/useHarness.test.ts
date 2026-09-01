// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHarness } from './useHarness';
import type { ClientMsg, HarnessTaskView } from '../../shared/protocol';

const tarefa = (id: string, ts: number, status: HarnessTaskView['status'] = 'running'): HarnessTaskView => ({
  id, ts, prompt: 'p', context: null, mode: 'auto', tier: 'simple', tierReason: '', model: 'sonnet', status,
});

const montar = () => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return true; });
  return { ...renderHook(() => useHarness(send)), enviados };
};

describe('useHarness', () => {
  it('reivindica config e lista', () => {
    const { result } = montar();
    act(() => { expect(result.current.onMsg({ t: 'harness-tasks', tasks: [tarefa('a', 1)] })).toBe(true); });
    expect(result.current.harnessTasks.map((t) => t.id)).toEqual(['a']);
  });

  // A tarefa chega 'running' e volta 'done' com o MESMO id: sem o upsert a lista
  // ganhava uma linha duplicada em vez de atualizar a existente.
  it('harness-task faz upsert por id, sem duplicar', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'harness-tasks', tasks: [tarefa('a', 10), tarefa('b', 5)] }); });
    act(() => { result.current.onMsg({ t: 'harness-task', task: tarefa('a', 10, 'done') }); });
    expect(result.current.harnessTasks.map((t) => t.id)).toEqual(['a', 'b']);
    expect(result.current.harnessTasks[0].status).toBe('done');
  });

  it('mantém a ordem por ts desc ao inserir uma tarefa antiga', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'harness-tasks', tasks: [tarefa('novo', 100)] }); });
    act(() => { result.current.onMsg({ t: 'harness-task', task: tarefa('velho', 1) }); });
    expect(result.current.harnessTasks.map((t) => t.id)).toEqual(['novo', 'velho']);
  });

  it('eventos acumulam por taskId sem vazar entre tarefas', () => {
    const { result } = montar();
    act(() => {
      result.current.onMsg({ t: 'harness-event', taskId: 'a', event: { kind: 'text', text: '1' } });
      result.current.onMsg({ t: 'harness-event', taskId: 'b', event: { kind: 'text', text: 'x' } });
      result.current.onMsg({ t: 'harness-event', taskId: 'a', event: { kind: 'text', text: '2' } });
    });
    expect(result.current.harnessEvents.a).toHaveLength(2);
    expect(result.current.harnessEvents.b).toHaveLength(1);
  });

  it('manda get e run', () => {
    const { result, enviados } = montar();
    act(() => { result.current.onHarnessGet(); result.current.onHarnessRun('faz', { mode: 'auto', via: 'plan' }, 'pentest'); });
    expect(enviados).toEqual([{ t: 'harness-get' }, { t: 'harness-run', prompt: 'faz', model: { mode: 'auto', via: 'plan' }, context: 'pentest' }]);
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'notes', text: '' })).toBe(false);
  });
});
