// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PlannerTask } from '../../shared/planner';
import { usePlanner } from './usePlanner';

const task = (id: string, o: Partial<PlannerTask> = {}): PlannerTask => ({
  id, title: id, description: '', links: [], difficulty: 1, column: 'today', order: 0, createdAt: 0, updatedAt: 0, ...o,
});

describe('usePlanner', () => {
  it('requests the board and applies planner-board frames', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => usePlanner(send));
    act(() => result.current.onPlannerGet());
    expect(send).toHaveBeenCalledWith({ t: 'planner-get' });
    act(() => { result.current.onMsg({ t: 'planner-board', tasks: [task('a')] }); });
    expect(result.current.loaded).toBe(true);
    expect(result.current.tasks).toHaveLength(1);
  });

  it('ignores other frames', () => {
    const { result } = renderHook(() => usePlanner(vi.fn(() => true)));
    expect(result.current.onMsg({ t: 'error', message: 'x' })).toBe(false);
  });

  it('moves optimistically and sends a reorder', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => usePlanner(send));
    act(() => { result.current.onMsg({ t: 'planner-board', tasks: [task('a')] }); });
    act(() => { result.current.onPlannerMove('a', 'done', 0); });
    expect(result.current.tasks[0]).toMatchObject({ column: 'done' });
    expect(result.current.tasks[0].doneAt).toBeTypeOf('number');
    expect(send).toHaveBeenCalledWith({ t: 'planner-reorder', moves: [{ id: 'a', column: 'done', order: 0 }] });
  });

  it('saves and deletes optimistically', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => usePlanner(send));
    act(() => result.current.onPlannerSave(task('b')));
    expect(result.current.tasks).toHaveLength(1);
    act(() => result.current.onPlannerDelete('b'));
    expect(result.current.tasks).toHaveLength(0);
    expect(send).toHaveBeenCalledWith({ t: 'planner-task-delete', id: 'b' });
  });
});
