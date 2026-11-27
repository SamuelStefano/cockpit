import type { ToolTodo } from '../../data/types';

export interface TaskProgress { done: number; total: number; current: string | null }

// The current item is only meaningful while the session is working on it.
export function taskProgress(todos: ToolTodo[] | undefined, running: boolean): TaskProgress | null {
  if (!todos?.length) return null;
  const doing = todos.find((t) => t.status === 'in_progress');
  return { done: todos.filter((t) => t.status === 'completed').length, total: todos.length, current: running && doing ? (doing.activeForm || doing.content) : null };
}

export const progressLabel = (p: TaskProgress) => (p.current ? `${p.done}/${p.total} · ${p.current}` : `${p.done}/${p.total}`);
