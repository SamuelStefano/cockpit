import type { Message, ToolTodo } from '../../data/mock';

// Última lista de tarefas da conversa: varre de trás pra frente e devolve o
// snapshot mais recente (TaskCreate/TaskUpdate/TodoWrite carimbam um por
// mutação). É o que o tray fixo mostra — como o painel do terminal, que
// exibe sempre o estado corrente, não o histórico.
export function latestTodos(messages: Message[]): ToolTodo[] | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    for (let j = m.blocks.length - 1; j >= 0; j--) {
      const b = m.blocks[j];
      if (b.type === 'tool' && b.tool.todos?.length) return b.tool.todos;
    }
  }
  return undefined;
}

export function todoCounts(todos: ToolTodo[]): { done: number; total: number; allDone: boolean } {
  const done = todos.filter((t) => t.status === 'completed').length;
  return { done, total: todos.length, allDone: done === todos.length };
}
