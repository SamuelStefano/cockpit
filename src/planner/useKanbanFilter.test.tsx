// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PlannerTask } from '../../shared/planner';
import { useKanbanFilter } from './useKanbanFilter';

const mk = (id: string, o: Partial<PlannerTask> = {}): PlannerTask => ({
  id, title: id, description: '', links: [], difficulty: 1, column: 'backlog', order: 0, createdAt: 0, updatedAt: 0, ...o,
});
const tasks = [mk('alpha', { tag: 'DFL' }), mk('beta', { tag: 'Itera' }), mk('gamma')];

describe('useKanbanFilter', () => {
  it('filters by query and toggled tags', () => {
    const { result } = renderHook(() => useKanbanFilter(tasks, true));
    expect(result.current.visible).toBe(tasks);
    expect(result.current.allTags).toEqual(['DFL', 'Itera']);
    act(() => result.current.setQuery('ta'));
    expect(result.current.visible.map((t) => t.id)).toEqual(['beta']);
    act(() => { result.current.setQuery(''); result.current.toggleTag('DFL'); });
    expect(result.current.visible.map((t) => t.id)).toEqual(['alpha']);
    act(() => result.current.toggleTag('DFL'));
    expect(result.current.filtering).toBe(false);
  });

  it('focuses the search on "/" outside inputs', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const { result } = renderHook(() => useKanbanFilter(tasks, true));
    (result.current.searchRef as { current: HTMLInputElement }).current = input;
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' })); });
    expect(document.activeElement).toBe(input);
  });
});
