import type { Message, ToolTodo } from '../../shared/protocol';
import type { Rec, ToolResultRec } from './records';

// O harness atual usa TaskCreate/TaskUpdate (não TodoWrite — zero ocorrências nos
// JSONLs reais) e a lista é ESTADO acumulado entre chamadas, não payload de uma
// chamada só. Reconstrói um registry (id → item) e tira snapshot a cada mutação,
// pro card mostrar a lista corrente como o terminal mostra.
export type TaskRegistry = Map<string, ToolTodo>;

const TASK_STATUSES: readonly string[] = ['pending', 'in_progress', 'completed'];

// TaskCreate só ganha id no tool_result ("Task #228 created successfully: …"):
// o input traz subject/activeForm, o result traz o número. Sem result (run morto
// no meio) ou com erro, a task não nasceu.
export function registerTaskCreate(tasks: TaskRegistry, input: unknown, res?: { output: string[]; isErr: boolean }): boolean {
  if (!res || res.isErr || !input || typeof input !== 'object') return false;
  const o = input as Record<string, unknown>;
  const content = typeof o.subject === 'string' && o.subject ? o.subject : '';
  if (!content) return false;
  const m = /Task\s*#\s*(\d+)/i.exec(res.output.join('\n'));
  if (!m) return false;
  const activeForm = typeof o.activeForm === 'string' && o.activeForm ? o.activeForm : undefined;
  tasks.set(m[1], { content, status: 'pending', activeForm });
  return true;
}

export function applyTaskUpdate(tasks: TaskRegistry, input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const o = input as Record<string, unknown>;
  const id = typeof o.taskId === 'string' || typeof o.taskId === 'number' ? String(o.taskId) : '';
  if (!id) return false;
  if (o.status === 'deleted') return tasks.delete(id);
  const prev = tasks.get(id);
  // Update de task criada fora da janela/sessão (a lista do harness é global):
  // entra como placeholder numerado — melhor que engolir a mudança de status.
  const content = typeof o.subject === 'string' && o.subject ? o.subject : prev?.content ?? `Tarefa #${id}`;
  const status = typeof o.status === 'string' && TASK_STATUSES.includes(o.status) ? (o.status as ToolTodo['status']) : prev?.status ?? 'pending';
  const activeForm = typeof o.activeForm === 'string' && o.activeForm ? o.activeForm : prev?.activeForm;
  tasks.set(id, { content, status, activeForm });
  return true;
}

export function taskSnapshot(tasks: TaskRegistry): ToolTodo[] | undefined {
  return tasks.size ? [...tasks.values()].map((t) => ({ ...t })) : undefined;
}

// Snapshot da lista por tool_use de TaskCreate/TaskUpdate — chave = id do tool_use,
// casando com ToolCall.id do recToMessage pro attach.
export function taskTodos(recs: Rec[], results: Map<string, ToolResultRec>): Map<string, ToolTodo[]> {
  const tasks: TaskRegistry = new Map();
  const out = new Map<string, ToolTodo[]>();
  for (const r of recs) {
    if (r.type !== 'assistant' || !r.message || !Array.isArray(r.message.content)) continue;
    for (const c of r.message.content as any[]) {
      if (c?.type !== 'tool_use' || typeof c.id !== 'string' || !c.id) continue;
      const changed = c.name === 'TaskCreate'
        ? registerTaskCreate(tasks, c.input, results.get(c.id))
        : c.name === 'TaskUpdate' ? applyTaskUpdate(tasks, c.input) : false;
      if (!changed) continue;
      const snap = taskSnapshot(tasks);
      if (snap) out.set(c.id, snap);
    }
  }
  return out;
}

// Snapshot FINAL do registry de tarefas do arquivo inteiro. A chain ativa
// pós-compact perde os TaskCreate/TaskUpdate antigos (ramo podado) — o tray
// precisa do estado corrente da sessão, não só do que está visível.
export function finalTodos(map: Map<string, ToolTodo[]>): ToolTodo[] | undefined {
  let last: ToolTodo[] | undefined;
  for (const v of map.values()) last = v;
  return last;
}

export function attachTaskTodos(messages: Message[], map: Map<string, ToolTodo[]>): void {
  if (!map.size) return;
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    for (const b of m.blocks) {
      if (b.type !== 'tool' || b.tool.todos) continue;
      const snap = map.get(b.tool.id);
      if (snap) b.tool.todos = snap;
    }
  }
}
