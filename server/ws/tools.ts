import type { ToolCall, ToolTodo } from '../../shared/protocol';
import { diffOf, planOf, questionsOf, todosOf, labelOf, commandOf, toolResultOutput, applyTaskUpdate, registerTaskCreate, taskSnapshot } from '../sessions/parse';
import { broadcast } from './broadcast';
import type { Thread } from './runs';

// Teto de tools retidas por thread: um run de horas com centenas de tools não
// pode crescer sem limite na memória (cada entrada é re-serializada no replay).
const MAX_TOOLS = 300;

// Upsert por id no snapshot do thread (mesma lógica do client upsertTool):
// preserva campos do evento running (diff/command) ao mesclar o done.
function snapshotTool(thread: Thread, tool: ToolCall) {
  const i = thread.tools.findIndex((t) => t.id === tool.id);
  if (i === -1) thread.tools.push(tool);
  else {
    const prev = thread.tools[i];
    thread.tools[i] = {
      ...prev,
      ...tool,
      label: tool.label && tool.label !== 'tool' ? tool.label : prev.label,
      name: tool.name && tool.name !== 'tool' ? tool.name : prev.name,
      command: tool.command || prev.command,
      output: tool.output.length ? tool.output : prev.output,
      diff: tool.diff ?? prev.diff,
      markdown: tool.markdown ?? prev.markdown,
      questions: tool.questions ?? prev.questions,
      todos: tool.todos ?? prev.todos,
    };
  }
  if (thread.tools.length > MAX_TOOLS) {
    // Some o toolStart das tools podadas: uma tool sem tool_result (run morto no
    // meio) nunca passa por closeTool, então sua chave em toolStart só seria
    // limpa aqui. Sem isto, um run de horas com >300 tools vaza timestamps.
    const dropped = thread.tools.splice(0, thread.tools.length - MAX_TOOLS);
    for (const d of dropped) thread.toolStart.delete(d.id);
  }
}

// Lista de tarefas ao vivo: TaskUpdate muda o registry na hora; TaskCreate só
// ganha o número da task no tool_result, então fica pendente até o closeTool.
function liveTaskTodos(thread: Thread, id: string, block: any): ToolTodo[] | undefined {
  if (!id || !block.input || typeof block.input !== 'object') return undefined;
  if (block.name === 'TaskCreate') {
    const subject = typeof block.input.subject === 'string' ? block.input.subject : '';
    const activeForm = typeof block.input.activeForm === 'string' && block.input.activeForm ? block.input.activeForm : undefined;
    if (subject) thread.taskCreates.set(id, { subject, activeForm });
    return undefined;
  }
  if (block.name === 'TaskUpdate' && applyTaskUpdate(thread.tasks, block.input)) return taskSnapshot(thread.tasks);
  return undefined;
}

export function emitTool(thread: Thread, sessionKey: string, block: any, status: ToolCall['status']) {
  const id = block.id ?? '';
  if (id && !thread.toolStart.has(id)) thread.toolStart.set(id, Date.now());
  const tool: ToolCall = {
    id,
    name: block.name ?? 'tool',
    label: labelOf(block.name, block.input),
    command: commandOf(block.name, block.input),
    status,
    diff: diffOf(block.name, block.input),
    markdown: planOf(block.name, block.input),
    questions: questionsOf(block.name, block.input),
    todos: todosOf(block.name, block.input) ?? liveTaskTodos(thread, id, block),
    output: [],
  };
  snapshotTool(thread, tool);
  broadcast({ t: 'tool', sessionKey, tool });
}

export function closeTool(thread: Thread, sessionKey: string, c: any) {
  const isErr = !!c.is_error;
  const output = toolResultOutput(c);
  const id = c.tool_use_id ?? '';
  const start = thread.toolStart.get(id);
  if (start !== undefined) thread.toolStart.delete(id);
  // TaskCreate pendente: o result traz o número da task ("Task #N created…") —
  // registra e carimba o snapshot da lista no card que fecha.
  let todos: ToolTodo[] | undefined;
  const pc = thread.taskCreates.get(id);
  if (pc) {
    thread.taskCreates.delete(id);
    if (registerTaskCreate(thread.tasks, pc, { output, isErr })) todos = taskSnapshot(thread.tasks);
  }
  const tool: ToolCall = {
    id,
    name: 'tool',
    label: 'tool',
    command: '',
    status: isErr ? 'error' : 'done',
    exit: isErr ? 1 : 0,
    output,
    expanded: true,
    durationMs: start !== undefined ? Date.now() - start : undefined,
    todos,
  };
  snapshotTool(thread, tool);
  broadcast({ t: 'tool', sessionKey, tool });
}
