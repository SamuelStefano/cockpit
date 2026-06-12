import { describe, it, expect } from 'vitest';
import { latestTodos, todoCounts } from './task-tray';
import type { Message, ToolTodo } from '../../data/mock';

const todo = (content: string, status: ToolTodo['status']): ToolTodo => ({ content, status });
const toolMsg = (id: string, todos?: ToolTodo[]): Message =>
  ({ id, role: 'assistant', blocks: [{ type: 'tool', tool: { id: `${id}-t`, name: 'TaskUpdate', label: 'x', command: '', status: 'done', output: [], todos } }] });

describe('latestTodos', () => {
  it('devolve o snapshot MAIS RECENTE da conversa', () => {
    const messages: Message[] = [
      toolMsg('a1', [todo('A', 'pending')]),
      { id: 'u1', role: 'user', text: 'oi' },
      toolMsg('a2', [todo('A', 'completed'), todo('B', 'in_progress')]),
    ];
    expect(latestTodos(messages)).toEqual([todo('A', 'completed'), todo('B', 'in_progress')]);
  });

  it('ignora tools sem todos e mensagens de usuário', () => {
    const messages: Message[] = [
      toolMsg('a1', [todo('A', 'pending')]),
      toolMsg('a2', undefined),
      { id: 'u1', role: 'user', text: 'oi' },
    ];
    expect(latestTodos(messages)).toEqual([todo('A', 'pending')]);
  });

  it('sem snapshot nenhum → undefined', () => {
    expect(latestTodos([{ id: 'u1', role: 'user', text: 'oi' } as Message])).toBeUndefined();
    expect(latestTodos([])).toBeUndefined();
  });

  it('dentro da mesma mensagem, vence o bloco mais recente', () => {
    const m: Message = { id: 'a1', role: 'assistant', blocks: [
      { type: 'tool', tool: { id: 't1', name: 'TaskUpdate', label: 'x', command: '', status: 'done', output: [], todos: [todo('velho', 'pending')] } },
      { type: 'tool', tool: { id: 't2', name: 'TaskUpdate', label: 'x', command: '', status: 'done', output: [], todos: [todo('novo', 'in_progress')] } },
    ] };
    expect(latestTodos([m])![0].content).toBe('novo');
  });
});

describe('todoCounts', () => {
  it('conta concluídas e detecta tudo-pronto', () => {
    expect(todoCounts([todo('A', 'completed'), todo('B', 'pending')])).toEqual({ done: 1, total: 2, allDone: false });
    expect(todoCounts([todo('A', 'completed')])).toEqual({ done: 1, total: 1, allDone: true });
  });
});
