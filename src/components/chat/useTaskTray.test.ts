// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTaskTray } from './useTaskTray';
import type { ToolTodo } from '../../data/types';

const KEY = 'cockpit:chat.taskTray.collapsed';
const todos: ToolTodo[] = [
  { content: 'a', status: 'completed' },
  { content: 'b', status: 'in_progress' },
];

beforeEach(() => localStorage.clear());

describe('useTaskTray', () => {
  it('nasce colapsado no mobile sem gravar a preferência do desktop', () => {
    const { result } = renderHook(() => useTaskTray({ todos, isMobile: true, keyboardOpen: false }));
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(null);
  });

  it('respeita a preferência salva no desktop', () => {
    localStorage.setItem(KEY, 'false');
    const { result } = renderHook(() => useTaskTray({ todos, isMobile: false, keyboardOpen: false }));
    expect(result.current.collapsed).toBe(false);
  });

  it('no mobile o toggle abre o sheet e não toca na chave persistida', () => {
    const { result } = renderHook(() => useTaskTray({ todos, isMobile: true, keyboardOpen: false }));
    act(() => result.current.toggle());
    expect(result.current.sheet).toBe(true);
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(null);
  });

  it('no desktop o toggle persiste', () => {
    const { result } = renderHook(() => useTaskTray({ todos, isMobile: false, keyboardOpen: false }));
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('com teclado aberto fica colapsado mesmo com a preferência expandida', () => {
    localStorage.setItem(KEY, 'false');
    const { result } = renderHook(() => useTaskTray({ todos, isMobile: true, keyboardOpen: true }));
    expect(result.current.collapsed).toBe(true);
    expect(result.current.sheet).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.sheet).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('false');
  });

  it('colapsa sozinho no desktop quando tudo conclui', () => {
    const done: ToolTodo[] = [{ content: 'a', status: 'completed' }, { content: 'b', status: 'completed' }];
    const { result, rerender } = renderHook(
      ({ list }) => useTaskTray({ todos: list, isMobile: false, keyboardOpen: false }),
      { initialProps: { list: todos } },
    );
    expect(result.current.collapsed).toBe(false);
    rerender({ list: done });
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  it('no mobile a conclusão não grava a preferência do desktop', () => {
    const done: ToolTodo[] = [{ content: 'a', status: 'completed' }, { content: 'b', status: 'completed' }];
    const { rerender } = renderHook(
      ({ list }) => useTaskTray({ todos: list, isMobile: true, keyboardOpen: false }),
      { initialProps: { list: todos } },
    );
    rerender({ list: done });
    expect(localStorage.getItem(KEY)).toBe(null);
  });
});
