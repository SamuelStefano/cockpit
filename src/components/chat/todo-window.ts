import type { ToolTodo } from '../../data/types';

// The collapsed list showed the first N items of the plan in order. In a long
// plan the item in progress sits past N once the early ones are done, so the
// collapsed panel showed only finished work. Keep the plan order, but slide the
// window so the active item (else the first pending one) is visible, with the
// item before it for context.
export function collapsedWindow(todos: ToolTodo[], limit: number): { start: number; end: number } {
  if (todos.length <= limit) return { start: 0, end: todos.length };
  let focus = todos.findIndex((t) => t.status === 'in_progress');
  if (focus < 0) focus = todos.findIndex((t) => t.status === 'pending');
  if (focus < 0) focus = todos.length - 1;
  const start = Math.max(0, Math.min(focus - 1, todos.length - limit));
  return { start, end: start + limit };
}
