import { useEffect, useRef } from 'react';
import { Icon, tokens } from '../primitives';
import { usePersisted } from '../../lib/persist';
import type { ToolTodo } from '../../data/mock';
import { TodoPanel } from './TodoPanel';
import { todoCounts } from './task-tray';

// Tray fixo de tarefas (paridade com o painel do terminal): a lista corrente
// fica sempre à vista acima do composer, em vez de enterrada nos cards do
// histórico. Colapsável a qualquer momento; quando TUDO conclui, colapsa
// sozinho UMA vez (na transição) — o usuário ainda pode reabrir pra conferir.
export function TaskTray({ todos }: { todos: ToolTodo[] }) {
  const [collapsed, setCollapsed] = usePersisted<boolean>('chat.taskTray.collapsed', false);
  const { done, total, allDone } = todoCounts(todos);
  const prevAllDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !prevAllDone.current) setCollapsed(true);
    prevAllDone.current = allDone;
  }, [allDone, setCollapsed]);

  return (
    <div className="border-t border-neutral-800/70 bg-neutral-950/60">
      <div className="mx-auto max-w-3xl px-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Mostrar tarefas' : 'Recolher tarefas'}
          className={`flex w-full items-center gap-1.5 py-1.5 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300 ${tokens.focusRing}`}
        >
          <Icon name="chevronRight" size={11} aria-hidden="true" className={`transition-transform ${collapsed ? '' : 'rotate-90'}`} />
          <Icon name="check" size={11} aria-hidden="true" className={allDone ? 'text-green-400' : 'text-orange-400'} />
          tarefas · {done}/{total}
          {collapsed && !allDone && (
            <span className="ml-1 truncate font-normal text-neutral-600">
              {todos.find((t) => t.status === 'in_progress')?.activeForm
                ?? todos.find((t) => t.status !== 'completed')?.content}
            </span>
          )}
        </button>
        {!collapsed && (
          <div className="scroll-thin -mx-3 max-h-44 overflow-y-auto pb-1">
            <TodoPanel todos={todos} header={false} />
          </div>
        )}
      </div>
    </div>
  );
}
