// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQueuedBanner } from './useQueuedBanner';

interface Props { queued: string[]; ids: string[] }

function setup(queued: string[], ids: string[]) {
  const onMove = vi.fn();
  const onEdit = vi.fn();
  const hook = renderHook((p: Props) => useQueuedBanner(p.queued, p.ids, onMove, onEdit), { initialProps: { queued, ids } });
  return { hook, onMove, onEdit };
}

describe('useQueuedBanner edit', () => {
  it('startEdit loads the item text and commit sends the draft with its current index', () => {
    const { hook, onEdit } = setup(['a', 'b'], ['x', 'y']);
    act(() => hook.result.current.startEdit('y'));
    expect(hook.result.current.draft).toBe('b');
    act(() => hook.result.current.setDraft('b fixed'));
    act(() => hook.result.current.commitEdit());
    expect(onEdit).toHaveBeenCalledWith(1, 'b fixed');
    expect(hook.result.current.editing).toBeNull();
  });

  it('commit without change (or empty) does not call onEdit', () => {
    const { hook, onEdit } = setup(['a'], ['x']);
    act(() => hook.result.current.startEdit('x'));
    act(() => hook.result.current.commitEdit());
    act(() => hook.result.current.startEdit('x'));
    act(() => hook.result.current.setDraft('   '));
    act(() => hook.result.current.commitEdit());
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('keeps editing the same item after a reorder, even with identical texts', () => {
    const { hook, onEdit } = setup(['same', 'same'], ['x', 'y']);
    act(() => hook.result.current.startEdit('y'));
    act(() => hook.result.current.setDraft('changed'));
    hook.rerender({ queued: ['same', 'same'], ids: ['y', 'x'] });
    expect(hook.result.current.editing).toBe('y');
    act(() => hook.result.current.commitEdit());
    expect(onEdit).toHaveBeenCalledWith(0, 'changed');
  });

  it('closes the editor when its item leaves the queue', () => {
    const { hook } = setup(['a', 'b'], ['x', 'y']);
    act(() => hook.result.current.startEdit('y'));
    hook.rerender({ queued: ['a'], ids: ['x'] });
    expect(hook.result.current.editing).toBeNull();
  });
});

describe('useQueuedBanner expand and launcher', () => {
  it('expanded state follows the item across a reorder', () => {
    const { hook } = setup(['a', 'b'], ['x', 'y']);
    act(() => hook.result.current.toggle('y'));
    hook.rerender({ queued: ['b', 'a'], ids: ['y', 'x'] });
    expect(hook.result.current.open).toEqual({ y: true });
  });

  it('toggleBg opens one item only and a second click closes', () => {
    const { hook } = setup(['a', 'b'], ['x', 'y']);
    act(() => hook.result.current.toggleBg('y'));
    expect(hook.result.current.bgOpen).toBe('y');
    act(() => hook.result.current.toggleBg('x'));
    expect(hook.result.current.bgOpen).toBe('x');
    act(() => hook.result.current.toggleBg('x'));
    expect(hook.result.current.bgOpen).toBeNull();
  });

  it('closes the launcher when the item is gone', () => {
    const { hook } = setup(['a', 'b'], ['x', 'y']);
    act(() => hook.result.current.toggleBg('y'));
    hook.rerender({ queued: ['a'], ids: ['x'] });
    expect(hook.result.current.bgOpen).toBeNull();
  });

  it('move resolves the index from the id', () => {
    const { hook, onMove } = setup(['a', 'b'], ['x', 'y']);
    act(() => hook.result.current.move('y', -1));
    expect(onMove).toHaveBeenCalledWith(1, -1);
    expect(hook.result.current.flash).toBe('y');
  });
});
