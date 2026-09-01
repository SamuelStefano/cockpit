import { describe, it, expect } from 'vitest';
import { registerTaskCreate, applyTaskUpdate, taskSnapshot, taskTodos, attachTaskTodos, finalTodos, type TaskRegistry } from './tasks';
import type { Message, ToolTodo } from '../../shared/protocol';
import type { Rec, ToolResultRec } from './records';

describe('registerTaskCreate / applyTaskUpdate / taskSnapshot (S6: lista de tarefas)', () => {
  it('TaskCreate registra a task com o número vindo do tool_result', () => {
    const tasks: TaskRegistry = new Map();
    const ok = registerTaskCreate(tasks, { subject: 'Corrigir bug', activeForm: 'Corrigindo bug' }, { output: ['Task #228 created successfully: Corrigir bug'], isErr: false });
    expect(ok).toBe(true);
    expect(tasks.get('228')).toEqual({ content: 'Corrigir bug', status: 'pending', activeForm: 'Corrigindo bug' });
  });

  it('TaskCreate sem result, com erro ou sem número não registra', () => {
    const tasks: TaskRegistry = new Map();
    expect(registerTaskCreate(tasks, { subject: 'x' }, undefined)).toBe(false);
    expect(registerTaskCreate(tasks, { subject: 'x' }, { output: ['Task #1 created'], isErr: true })).toBe(false);
    expect(registerTaskCreate(tasks, { subject: 'x' }, { output: ['sem numero'], isErr: false })).toBe(false);
    expect(registerTaskCreate(tasks, { nada: true }, { output: ['Task #1 created'], isErr: false })).toBe(false);
    expect(tasks.size).toBe(0);
  });

  it('TaskUpdate muda status, preserva campos anteriores e remove com deleted', () => {
    const tasks: TaskRegistry = new Map([['1', { content: 'A', status: 'pending' as const, activeForm: 'Fazendo A' }]]);
    expect(applyTaskUpdate(tasks, { taskId: '1', status: 'in_progress' })).toBe(true);
    expect(tasks.get('1')).toEqual({ content: 'A', status: 'in_progress', activeForm: 'Fazendo A' });
    expect(applyTaskUpdate(tasks, { taskId: 1, status: 'completed' })).toBe(true);
    expect(tasks.get('1')?.status).toBe('completed');
    expect(applyTaskUpdate(tasks, { taskId: '1', status: 'deleted' })).toBe(true);
    expect(tasks.size).toBe(0);
  });

  it('TaskUpdate de task desconhecida cria placeholder (lista global do harness)', () => {
    const tasks: TaskRegistry = new Map();
    expect(applyTaskUpdate(tasks, { taskId: '42', status: 'in_progress' })).toBe(true);
    expect(tasks.get('42')).toEqual({ content: 'Tarefa #42', status: 'in_progress', activeForm: undefined });
  });

  it('TaskUpdate sem taskId ou status inválido não quebra', () => {
    const tasks: TaskRegistry = new Map();
    expect(applyTaskUpdate(tasks, { status: 'in_progress' })).toBe(false);
    expect(applyTaskUpdate(tasks, null)).toBe(false);
    expect(applyTaskUpdate(tasks, { taskId: '9', status: 'banana' })).toBe(true);
    expect(tasks.get('9')?.status).toBe('pending');
  });

  it('taskSnapshot copia os itens (mutação posterior não vaza pro snapshot)', () => {
    const tasks: TaskRegistry = new Map([['1', { content: 'A', status: 'pending' as const }]]);
    const snap = taskSnapshot(tasks)!;
    tasks.get('1')!.status = 'completed';
    expect(snap[0].status).toBe('pending');
    expect(taskSnapshot(new Map())).toBeUndefined();
  });
});

describe('taskTodos + attachTaskTodos (S6: snapshots por tool_use)', () => {
  const asstTool = (uuid: string, id: string, name: string, input: unknown): Rec =>
    ({ type: 'assistant', uuid, message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });

  it('carimba snapshot acumulado em cada mutação (create → update)', () => {
    const recs = [
      asstTool('a1', 'tc1', 'TaskCreate', { subject: 'A', activeForm: 'Fazendo A' }),
      asstTool('a2', 'tu1', 'TaskUpdate', { taskId: '1', status: 'in_progress' }),
    ];
    const results = new Map<string, ToolResultRec>([['tc1', { output: ['Task #1 created successfully'], isErr: false }]]);
    const map = taskTodos(recs, results);
    expect(map.get('tc1')).toEqual([{ content: 'A', status: 'pending', activeForm: 'Fazendo A' }]);
    expect(map.get('tu1')).toEqual([{ content: 'A', status: 'in_progress', activeForm: 'Fazendo A' }]);
  });

  it('ignora tools sem mutação e TaskCreate sem result', () => {
    const recs = [
      asstTool('a1', 'b1', 'Bash', { command: 'ls' }),
      asstTool('a2', 'tc1', 'TaskCreate', { subject: 'A' }),
    ];
    expect(taskTodos(recs, new Map()).size).toBe(0);
  });

  it('attachTaskTodos anota o tool block certo e não sobrescreve todos existentes', () => {
    const messages: Message[] = [
      { id: 'a1', role: 'assistant', blocks: [
        { type: 'tool', tool: { id: 'tc1', name: 'TaskCreate', label: 'x', command: '', status: 'done', output: [] } },
        { type: 'tool', tool: { id: 'tw1', name: 'TodoWrite', label: 'x', command: '', status: 'done', output: [], todos: [{ content: 'Velho', status: 'pending' }] } },
      ] },
    ];
    attachTaskTodos(messages, new Map([
      ['tc1', [{ content: 'Novo', status: 'pending' }]],
      ['tw1', [{ content: 'NÃO', status: 'pending' }]],
    ]));
    const blocks = (messages[0] as any).blocks;
    expect(blocks[0].tool.todos).toEqual([{ content: 'Novo', status: 'pending' }]);
    expect(blocks[1].tool.todos).toEqual([{ content: 'Velho', status: 'pending' }]);
  });
});

describe('finalTodos (tray pós-compact)', () => {
  it('devolve o último snapshot do map (ordem do arquivo)', () => {
    const map = new Map([
      ['t1', [{ content: 'A', status: 'pending' as const }]],
      ['t2', [{ content: 'A', status: 'completed' as const }]],
    ]);
    expect(finalTodos(map)).toEqual([{ content: 'A', status: 'completed' }]);
    expect(finalTodos(new Map())).toBeUndefined();
  });
});
