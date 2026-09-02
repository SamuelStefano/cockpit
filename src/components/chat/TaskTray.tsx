import { Icon, tokens } from '../primitives';
import type { ToolTodo } from '../../data/types';
import { TodoPanel } from './TodoPanel';
import { TaskTraySheet } from './TaskTraySheet';
import { useTaskTray } from './useTaskTray';

// Tray fixo de tarefas (paridade com o painel do terminal): a lista corrente
// fica sempre à vista acima do composer, em vez de enterrada nos cards do
// histórico. No desktop expande inline; no celular, em bottom sheet.
export function TaskTray({ todos, isMobile = false, keyboardOpen = false }: {
  todos: ToolTodo[];
  isMobile?: boolean;
  keyboardOpen?: boolean;
}) {
  const { done, total, allDone, collapsed, sheet, closeSheet, toggle } = useTaskTray({ todos, isMobile, keyboardOpen });

  return (
    <div className="border-t border-neutral-800/70 bg-neutral-950/60">
      <div className="mx-auto max-w-3xl px-4">
        <button
          onClick={toggle}
          aria-expanded={isMobile ? sheet : !collapsed}
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
      {sheet && <TaskTraySheet todos={todos} onClose={closeSheet} />}
    </div>
  );
}
