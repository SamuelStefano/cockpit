import type { DflDraftTask, DraftOp } from '../../../shared/dfl-drafts';
import { MAX_DRAFT_POINTS } from '../../../shared/dfl-drafts';
import { Badge, Button, InlineEdit } from '../../components/primitives';
import { fmtPts } from './money';

interface Props {
  epicId: string;
  task: DflDraftTask;
  onOp: (op: DraftOp) => void;
}

const validPoints = (v: string): boolean => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= MAX_DRAFT_POINTS;
};

export function DraftTaskRow({ epicId, task, onOp }: Props) {
  return (
    <li className="flex items-start gap-2 px-3.5 py-2">
      <div className="min-w-0 flex-1">
        <InlineEdit label="título da task" hint={false} value={task.title}
          onSave={(title) => onOp({ op: 'update-task', epicId, taskId: task.id, title })}
          className="text-[12.5px] leading-snug text-neutral-200" inputClassName="w-full text-[12.5px]" />
        {task.refs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {task.refs.map((r, i) => <Badge key={`${i}:${r}`} className="font-mono">{r}</Badge>)}
          </div>
        )}
      </div>
      <InlineEdit label="pontos" numeric value={fmtPts(task.points)} validate={validPoints}
        display={<>{fmtPts(task.points)} <span className="text-[10.5px] text-neutral-500">pt</span></>}
        onSave={(v) => onOp({ op: 'update-task', epicId, taskId: task.id, points: Number(v.replace(',', '.')) })}
        className="shrink-0 pt-0.5 text-[12.5px] font-semibold text-neutral-100" inputClassName="w-16 text-[12.5px]" />
      <Button variant="ghost" size="sm" square icon="x" title="Tirar task do rascunho" aria-label="Tirar task do rascunho"
        onClick={() => onOp({ op: 'delete-task', epicId, taskId: task.id })} />
    </li>
  );
}
