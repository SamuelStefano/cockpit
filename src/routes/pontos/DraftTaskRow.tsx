import type { DflDraftTask, DraftOp } from '../../../shared/dfl-drafts';
import { MAX_DRAFT_POINTS } from '../../../shared/dfl-drafts';
import { Badge, Button, Checkbox, InlineEdit } from '../../components/primitives';
import { RefChips } from './RefChips';
import { dragTask } from './useDropZone';
import { fmtPts } from './money';

interface Props {
  epicId: string;
  task: DflDraftTask;
  selected: boolean;
  onToggle: (id: string) => void;
  onOp: (op: DraftOp) => void;
}

const validPoints = (v: string): boolean => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= MAX_DRAFT_POINTS;
};

const TASK_GRID = 'grid grid-cols-[14px_minmax(0,1fr)_52px_24px] items-center gap-x-2.5 sm:grid-cols-[14px_minmax(0,1fr)_auto_52px_24px]';

// One task, one line: select, title (click to edit), PR chips, points (click to
// edit), remove. Draggable onto another delivery.
export function DraftTaskRow({ epicId, task, selected, onToggle, onOp }: Props) {
  const sent = task.status !== 'draft';
  return (
    <li
      draggable onDragStart={(e) => dragTask(e, task.id)}
      className={`${TASK_GRID} min-h-[34px] cursor-grab px-2.5 py-1 active:cursor-grabbing ${selected ? 'bg-orange-500/[0.07]' : 'hover:bg-neutral-800/30'}`}
    >
      <Checkbox checked={selected} onChange={() => onToggle(task.id)} label={`Selecionar ${task.title}`} />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <InlineEdit label="título da task" hint={false} value={task.title}
          onSave={(title) => onOp({ op: 'update-task', epicId, taskId: task.id, title })}
          className={`text-[12.5px] leading-snug ${sent ? 'text-neutral-400' : 'text-neutral-200'}`} inputClassName="w-full text-[12.5px]" />
        {sent && <Badge tone={task.status === 'created' ? 'green' : 'orange'}>{task.status === 'created' ? 'criada' : 'enviada'}</Badge>}
        <span className="sm:hidden"><RefChips refs={task.refs} /></span>
      </div>
      <span className="hidden sm:inline-flex"><RefChips refs={task.refs} /></span>
      <InlineEdit label="pontos" numeric value={fmtPts(task.points)} validate={validPoints}
        display={<>{fmtPts(task.points)} <span className="text-[10px] text-neutral-500">pt</span></>}
        onSave={(v) => onOp({ op: 'update-task', epicId, taskId: task.id, points: Number(v.replace(',', '.')) })}
        className="justify-self-end font-mono text-[12.5px] font-medium text-neutral-100" inputClassName="w-14 text-[12.5px]" />
      <Button variant="ghost" size="xs" square icon="x" title="Tirar task do rascunho" aria-label="Tirar task do rascunho"
        className="opacity-60 hover:opacity-100" onClick={() => onOp({ op: 'delete-task', epicId, taskId: task.id })} />
    </li>
  );
}
