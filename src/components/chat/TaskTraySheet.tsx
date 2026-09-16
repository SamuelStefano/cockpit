import { Icon, tokens } from '../primitives';
import { TodoPanel } from './TodoPanel';
import { todoCounts } from './task-tray';
import type { ToolTodo } from '../../data/types';

// Lista completa de tarefas no celular: bottom sheet (mesmo padrão do McpPicker)
// em vez de empurrar o composer. Expandido inline, o tray comia 176px de uma tela
// de 420px com o teclado aberto.
export function TaskTraySheet({ todos, onClose }: { todos: ToolTodo[]; onClose: () => void }) {
  const { done, total } = todoCounts(todos);
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40 sm:hidden" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Tarefas da sessão"
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70dvh] flex-col rounded-t-2xl border border-neutral-700 bg-neutral-900 pb-[env(safe-area-inset-bottom)] shadow-xl shadow-black/50"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-2">
          <Icon name="check" size={12} className="text-orange-400" />
          <span className="flex-1 text-[11.5px] font-medium text-neutral-300">tarefas · {done}/{total}</span>
          <button
            onClick={onClose}
            aria-label="Fechar tarefas"
            className={`rounded-sm p-1 text-neutral-500 transition hover:text-neutral-200 ${tokens.focusRing}`}
          >
            <Icon name="x" size={13} />
          </button>
        </div>
        {/* Lista rola por flex + min-h-0 (mesma casca do PickerSheet): um max-height
            fixo somado ao header e ao padding de safe-area estourava os 70dvh. */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
          <TodoPanel todos={todos} header={false} />
        </div>
      </div>
    </>
  );
}
