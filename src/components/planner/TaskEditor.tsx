import type { PlannerTask } from '../../../shared/planner';
import { Button } from '../primitives';
import { useArmed } from '../primitives/useArmed';
import { useTaskEditor } from '../../planner/useTaskEditor';
import { TaskEditorFields } from './TaskEditorFields';

interface TaskEditorProps {
  task: PlannerTask;
  onSave: (task: PlannerTask) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export function TaskEditor({ task, onSave, onDelete, onBack }: TaskEditorProps) {
  const ed = useTaskEditor(task, onSave, onBack);
  const del = useArmed();
  return (
    <div className="absolute inset-0 z-10 flex justify-end">
      <div className="fade-in absolute inset-0 bg-black/50 max-sm:hidden" onClick={onBack} aria-hidden />
      <aside
        role="dialog" aria-label="Editar task" onKeyDown={ed.onKeyDown}
        className="slide-up-in relative flex h-full w-[min(460px,100%)] flex-col border-l border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/60 max-sm:w-full max-sm:border-0"
      >
        <div className="flex items-center gap-2 border-b border-neutral-800/80 px-4 py-2.5">
          <span className="flex-1 text-[13px] font-medium text-neutral-300">Editar task</span>
          <Button variant="ghost" size="sm" square icon="x" aria-label="Fechar editor" title="Fechar (Esc)" onClick={onBack} />
        </div>
        <TaskEditorFields draft={ed.draft} patch={ed.patch} refInvalid={ed.refInvalid} />
        <div className="flex items-center gap-2 border-t border-neutral-800/80 px-4 py-3">
          <Button variant="danger" size="sm" icon="trash" onClick={() => del.fire(() => onDelete(task.id))}>{del.armed ? 'Confirmar?' : 'Excluir'}</Button>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-neutral-600 max-sm:hidden">Ctrl+Enter</span>
            <Button variant="ghost" size="sm" onClick={onBack}>Cancelar</Button>
            <Button size="sm" disabled={!ed.valid} onClick={ed.save}>Salvar</Button>
          </span>
        </div>
      </aside>
    </div>
  );
}
