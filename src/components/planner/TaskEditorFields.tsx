import type { ReactNode } from 'react';
import type { PlannerColumn, PlannerDifficulty, PlannerTask } from '../../../shared/planner';
import { PLANNER_COLUMNS, PLANNER_LIMITS } from '../../../shared/planner';
import { Input, Segmented } from '../primitives';
import { COLUMN_LABELS, DIFFICULTY_LABELS, isLockedRef } from '../../planner/planner-logic';
import { isHttpUrl } from '../../planner/useTaskEditor';
import { TaskLinksEditor } from './TaskLinksEditor';
import { TaskLinksView } from './TaskLinksView';

interface Props { draft: PlannerTask; patch: (p: Partial<PlannerTask>) => void; refInvalid: boolean }

const diffItems = ([1, 2, 3] as const).map((n) => ({ id: String(n), label: DIFFICULTY_LABELS[n] }));
const colItems = PLANNER_COLUMNS.map((c) => ({ id: c, label: COLUMN_LABELS[c] }));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

export function TaskEditorFields({ draft, patch, refInvalid }: Props) {
  const locked = isLockedRef(draft.ref);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
      <Field label="Título">
        <Input autoFocus value={draft.title} maxLength={PLANNER_LIMITS.title} onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <Field label="Descrição">
        <textarea
          value={draft.description} maxLength={PLANNER_LIMITS.description} rows={5} onChange={(e) => patch({ description: e.target.value })}
          className="resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] leading-relaxed text-neutral-200 focus-visible:border-orange-500/40 focus-visible:outline-hidden"
        />
      </Field>
      <div className="flex flex-col gap-1.5"><span className="text-[12px] text-neutral-500">Coluna</span>
        <Segmented<PlannerColumn> label="Coluna" items={colItems} value={draft.column} onChange={(c) => patch({ column: c })} className="self-start" />
      </div>
      <div className="flex flex-col gap-1.5"><span className="text-[12px] text-neutral-500">Dificuldade</span>
        <Segmented label="Dificuldade" items={diffItems} value={String(draft.difficulty)} onChange={(v) => patch({ difficulty: Number(v) as PlannerDifficulty })} className="self-start" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tag">
          <Input size="sm" value={draft.tag ?? ''} maxLength={PLANNER_LIMITS.tag} placeholder="DFL, Itera…" onChange={(e) => patch({ tag: e.target.value })} />
        </Field>
        <Field label={locked ? 'Ref (DFL)' : 'Ref'}>
          <Input
            size="sm" mono value={draft.ref ?? ''} maxLength={PLANNER_LIMITS.ref} readOnly={locked} error={refInvalid}
            placeholder="opcional" onChange={(e) => patch({ ref: e.target.value })} className={locked ? 'text-neutral-500' : ''}
          />
        </Field>
      </div>
      <div className="flex flex-col gap-1.5"><span className="text-[12px] text-neutral-500">Links</span>
        <TaskLinksEditor links={draft.links} onChange={(links) => patch({ links })} />
        <TaskLinksView links={draft.links.filter((l) => isHttpUrl(l.url))} />
      </div>
    </div>
  );
}
