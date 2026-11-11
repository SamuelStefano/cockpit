import { useState } from 'react';
import type { PlannerColumn, PlannerDifficulty, PlannerTask } from '../../../shared/planner';
import { PLANNER_LIMITS } from '../../../shared/planner';
import { Button, Input, Segmented } from '../primitives';
import { useArmed } from '../primitives/useArmed';
import { COLUMN_LABELS, DIFFICULTY_LABELS, taskXp } from '../../planner/planner-logic';
import { TaskLinksView } from './TaskLinksView';
import { isHttpUrl, TaskLinksEditor } from './TaskLinksEditor';

interface TaskEditorProps {
  task: PlannerTask;
  onSave: (task: PlannerTask) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

const label = 'text-[12px] font-medium uppercase tracking-[0.06em] text-neutral-500';
const diffItems = ([1, 2, 3] as const).map((n) => ({ id: String(n), label: DIFFICULTY_LABELS[n] }));
const colItems = (['today', 'week', 'backlog', 'done'] as const).map((c) => ({ id: c, label: COLUMN_LABELS[c] }));

export function TaskEditor({ task, onSave, onDelete, onBack }: TaskEditorProps) {
  const [draft, setDraft] = useState(task);
  const del = useArmed();
  const patch = (p: Partial<PlannerTask>) => setDraft((d) => ({ ...d, ...p }));
  const valid = draft.title.trim() !== '';
  const save = () => {
    if (!valid) return;
    onSave({ ...draft, title: draft.title.trim(), links: draft.links.filter((l) => isHttpUrl(l.url)).map((l) => ({ ...l, url: l.url.trim() })) });
    onBack();
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        <label className="flex flex-col gap-1.5"><span className={label}>Título</span>
          <Input autoFocus value={draft.title} maxLength={PLANNER_LIMITS.title} onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5"><span className={label}>Descrição</span>
          <textarea
            value={draft.description} maxLength={PLANNER_LIMITS.description} rows={6} onChange={(e) => patch({ description: e.target.value })}
            className="resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 focus-visible:border-orange-500/40 focus-visible:outline-hidden"
          />
        </label>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5"><span className={label}>Dificuldade · {taskXp(draft)} XP</span>
            <Segmented label="Dificuldade" items={diffItems} value={String(draft.difficulty)} onChange={(v) => patch({ difficulty: Number(v) as PlannerDifficulty })} />
          </div>
          <div className="flex flex-col gap-1.5"><span className={label}>Coluna</span>
            <Segmented<PlannerColumn> label="Coluna" items={colItems} value={draft.column} onChange={(c) => patch({ column: c })} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5"><span className={label}>Links</span>
          <TaskLinksEditor links={draft.links} onChange={(links) => patch({ links })} />
          <TaskLinksView links={draft.links.filter((l) => isHttpUrl(l.url))} />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-neutral-800 px-4 py-3">
        <Button variant="danger" size="sm" icon="trash" onClick={() => del.fire(() => onDelete(task.id))}>{del.armed ? 'Confirmar?' : 'Excluir'}</Button>
        <span className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>Cancelar</Button>
          <Button size="sm" disabled={!valid} onClick={save}>Salvar</Button>
        </span>
      </div>
    </div>
  );
}
