// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { sanitizeDrafts, type DflDraft, type DraftOp } from '../../../shared/dfl-drafts';
import { useDraftEpic } from './useDraftEpic';

// d1 = t0, t1 · d2 = t2 (t2 already sent to the agent)
const draft = (): DflDraft => sanitizeDrafts([{
  id: 'ep-1', title: 'Studio', status: 'draft', createdAt: 0,
  tasks: [
    { id: 't0', title: 'a', points: 40, refs: [] },
    { id: 't1', title: 'b', points: 30, refs: [] },
    { id: 't2', title: 'c', points: 2, refs: [], status: 'dispatched' },
  ],
  deliveries: [{ id: 'd1', title: 'Front', taskIds: ['t0', 't1'] }, { id: 'd2', title: 'Back', taskIds: ['t2'] }],
}])[0];

function mount() {
  const ops: DraftOp[] = [];
  const ask = vi.fn();
  const r = renderHook(() => useDraftEpic({ draft: draft(), pointValue: 75, op: (o) => ops.push(o), ask }));
  return { r, ops, ask };
}

describe('useDraftEpic', () => {
  it('reads the epic: over the cap, partly sent, with a split that fixes it', () => {
    const { r, ops } = mount();
    expect(r.result.current.cap).toMatchObject({ points: 72, over: true });
    expect(r.result.current.progress).toBe('partial');
    expect(r.result.current.pending).toBe(2);
    expect(r.result.current.canAutoSplit).toBe(true);
    act(() => r.result.current.autoSplit());
    expect(ops).toEqual([{ op: 'split-epic', id: 'ep-1', taskIds: ['t1'] }]);
  });

  it('selection → move, new delivery, split; each clears the selection', () => {
    const { r, ops } = mount();
    act(() => r.result.current.setMany(['t0', 't1'], true));
    expect(r.result.current.selection).toMatchObject({ count: 2, points: 70, valueCents: 525_000, pending: 2 });
    act(() => r.result.current.moveTo('d2'));
    expect(ops.at(-1)).toEqual({ op: 'move-tasks', epicId: 'ep-1', taskIds: ['t0', 't1'], deliveryId: 'd2' });
    expect(r.result.current.selection.count).toBe(0);
    act(() => r.result.current.toggle('t1'));
    act(() => r.result.current.moveToNew());
    expect(ops.at(-1)).toEqual({ op: 'add-delivery', epicId: 'ep-1', taskIds: ['t1'] });
    act(() => r.result.current.toggle('t0'));
    act(() => r.result.current.splitSelected());
    expect(ops.at(-1)).toEqual({ op: 'split-epic', id: 'ep-1', taskIds: ['t0'] });
  });

  it('dragging a selected row carries the selection; an unselected row goes alone', () => {
    const { r, ops } = mount();
    act(() => r.result.current.setMany(['t0', 't1'], true));
    act(() => r.result.current.drop('d2', 't2'));
    expect(ops.at(-1)).toMatchObject({ taskIds: ['t2'] });
    act(() => r.result.current.drop('d2', 't0'));
    expect(ops.at(-1)).toMatchObject({ taskIds: ['t0', 't1'] });
  });

  it('agent actions hand over only pending tasks, at the right level', () => {
    const { r, ask } = mount();
    act(() => r.result.current.createAll());
    expect(ask).toHaveBeenLastCalledWith('Criar o restante do épico no DFL', [expect.objectContaining({ taskIds: ['t0', 't1'] })]);
    act(() => r.result.current.createDelivery('d2'));
    expect(ask).toHaveBeenLastCalledWith('Criar só esta delivery no DFL', [null]);
    act(() => r.result.current.setMany(['t1', 't2'], true));
    act(() => r.result.current.createSelected());
    expect(ask.mock.lastCall?.[1]).toEqual([expect.objectContaining({ taskIds: ['t1'] })]);
  });

  it('delete needs two taps', () => {
    const { r, ops } = mount();
    act(() => r.result.current.clickDelete());
    expect(ops).toEqual([]);
    act(() => r.result.current.clickDelete());
    expect(ops).toEqual([{ op: 'delete-epic', id: 'ep-1' }]);
  });
});
