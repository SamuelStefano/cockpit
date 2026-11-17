import type { PlannerTask } from '../../../shared/planner';
import { isUnsafeTask } from '../../../shared/village-risk';
import { Button } from '../primitives';

const sameContent = (a: PlannerTask, b: PlannerTask) => a.title === b.title && a.description === b.description
  && JSON.stringify(a.links) === JSON.stringify(b.links) && (a.ownerBotId ?? '') === (b.ownerBotId ?? '');

export function ReadyPanel({ task, draft, onReady }: { task: PlannerTask; draft: PlannerTask; onReady: (id: string, ready: boolean) => void }) {
  if (task.column === 'done') return null;
  const unsafe = isUnsafeTask(task);
  const dirty = !sameContent(task, draft);
  const blocked = unsafe ? 'Insegura: a vila nunca pega' : dirty ? 'Salve as edições antes' : !task.ownerBotId && !task.ownerSector ? 'Defina dono ou setor' : '';
  return (
    <div className="flex flex-col gap-1.5 border-t border-neutral-800/80 px-4 py-3">
      {task.wantReady && <p className="text-[12px] text-amber-300/80">{task.wantReady.by} sugere pronta: {task.wantReady.reason}</p>}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-neutral-500">{task.ready ? 'Pronta para a vila' : 'Não pronta'}</span>
        <Button
          className="ml-auto" size="sm" variant={task.ready ? 'ghost' : 'primary'} disabled={!task.ready && !!blocked} title={blocked || undefined}
          onClick={() => onReady(task.id, !task.ready)}
        >{task.ready ? 'Tirar pronta' : 'Marcar pronta'}</Button>
      </div>
    </div>
  );
}
