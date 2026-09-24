import { deliveryTasks, draftPoints, type DflDraft, type DflDraftDelivery, type DraftOp } from '../../../shared/dfl-drafts';
import { Badge, Button, Checkbox, InlineEdit } from '../../components/primitives';
import { DraftTaskRow } from './DraftTaskRow';
import { AddTaskRow } from './AddTaskRow';
import { useDropZone } from './useDropZone';
import { brlShort, centsFromPoints, fmtPts } from './money';
import { useArmed } from '../../components/primitives/useArmed';

interface Props {
  draft: DflDraft;
  delivery: DflDraftDelivery;
  pointValue: number;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
  onDrop: (deliveryId: string, taskId: string) => void;
  onCreate: (deliveryId: string) => void;
  onOp: (op: DraftOp) => void;
}

// A delivery of a draft epic: its header (rename, totals, "criar só esta
// delivery", remove) over a dense task table. Tasks dropped here move into it.
export function DraftDeliverySection({ draft, delivery, pointValue, selected, onToggle, onSetMany, onDrop, onCreate, onOp }: Props) {
  const tasks = deliveryTasks(draft, delivery.id);
  const ids = tasks.map((t) => t.id);
  const picked = ids.filter((id) => selected.has(id)).length;
  const pts = draftPoints({ tasks });
  const pending = tasks.filter((t) => t.status === 'draft').length;
  const drop = useDropZone((taskId) => onDrop(delivery.id, taskId));
  const epicId = draft.id;

  const del = useArmed();
  return (
    <section {...drop.bind} aria-label={delivery.title}
      className={`overflow-hidden rounded-lg border transition ${drop.over ? 'border-orange-500/60 bg-orange-500/[0.04]' : 'border-neutral-800/80 bg-neutral-900/30'}`}>
      <div className="flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-neutral-800/70 bg-neutral-900/50 px-2.5 py-1">
        <Checkbox checked={!!ids.length && picked === ids.length} indeterminate={picked > 0 && picked < ids.length} disabled={!ids.length}
          onChange={(on) => onSetMany(ids, on)} label={`Selecionar todas de ${delivery.title}`} />
        <span className="font-mono text-[10px] lowercase tracking-wide text-neutral-600">delivery</span>
        <InlineEdit label="título da delivery" hint={false} value={delivery.title}
          onSave={(title) => onOp({ op: 'rename-delivery', epicId, deliveryId: delivery.id, title })}
          className="min-w-0 truncate text-[12.5px] font-medium text-neutral-100" inputClassName="w-72 max-w-full text-[12.5px]" />
        <span className="font-mono text-[11px] tabular-nums text-neutral-500">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} · {fmtPts(pts)} pt · {brlShort(centsFromPoints(pts, pointValue))}
        </span>
        {tasks.length > 0 && pending === 0 && <Badge tone="orange">enviada</Badge>}
        <span className="ml-auto flex items-center gap-1">
          {pending > 0 && (
            <Button variant="outline" size="xs" icon="zap" onClick={() => onCreate(delivery.id)}
              title="Mandar o agente criar só esta delivery no DFL">criar só esta</Button>
          )}
          {draft.deliveries.length > 1 && (
            del.armed
              ? <Button variant="danger" size="xs" onClick={() => del.fire(() => onOp({ op: 'delete-delivery', epicId, deliveryId: delivery.id }))}>remover?</Button>
              : <Button variant="ghost" size="xs" square icon="x" onClick={() => del.fire(() => {})}
                  title="Remover delivery (as tasks vão pra primeira)" aria-label="Remover delivery" />
          )}
        </span>
      </div>
      <ul className="divide-y divide-neutral-800/50">
        {tasks.length === 0 && <li className="px-3 py-2.5 text-[11.5px] text-neutral-600">Vazia. Arraste tasks pra cá ou selecione e use “mover”.</li>}
        {tasks.map((t) => <DraftTaskRow key={t.id} epicId={epicId} task={t} selected={selected.has(t.id)} onToggle={onToggle} onOp={onOp} />)}
      </ul>
      <div className="border-t border-neutral-800/50">
        <AddTaskRow onAdd={(title, points) => onOp({ op: 'add-task', epicId, deliveryId: delivery.id, title, points })} />
      </div>
    </section>
  );
}
