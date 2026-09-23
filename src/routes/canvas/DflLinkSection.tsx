import type { CanvasCard } from '../../../shared/canvas';
import type { DflPointsSnapshot } from '../../../shared/protocol';
import type { DflWriteResult } from '../../cockpit/usePoints';
import { Badge, Button, Input, ToggleChip } from '../../components/primitives';
import { flattenDflTasks, useDflTaskLink } from './useDflTaskLink';

interface Props {
  card: CanvasCard;
  isDflArea: boolean;
  snapshot: DflPointsSnapshot | null;
  onLink: (cardId: string, taskId: string) => Promise<DflWriteResult>;
  onCreateLink: (cardId: string, taskName: string, epicId: string, deliveryId: string) => Promise<DflWriteResult>;
  onUnlink: (cardId: string) => boolean;
}

// CardEditor's "vincular à task DFL" — opt-in per card, never automatic. Only
// rendered at all for a card already linked (so unlinking always stays
// reachable even if the card's area drifted) or one whose area IS 'dfl'
// (server/canvas/areas.ts — recomputed server-side; a card here linking
// still goes through the server's own guard, this is only the affordance).
export function DflLinkSection({ card, isDflArea, snapshot, onLink, onCreateLink, onUnlink }: Props) {
  const s = useDflTaskLink({ card, snapshot, onLink, onCreateLink, onUnlink });
  if (!isDflArea && !card.dfl) return null;

  if (card.dfl) {
    const linked = flattenDflTasks(snapshot).find((t) => t.id === card.dfl!.taskId);
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <Badge tone="orange">DFL</Badge>
            <span className="ml-1.5 truncate text-[11.5px] text-neutral-300">{linked?.name ?? card.dfl.taskId}</span>
          </div>
          <Button size="xs" variant="ghost" onClick={s.unlink}>desvincular</Button>
        </div>
        {card.dfl.error && <p className="mt-1 text-[10.5px] text-red-400">sync pendente: {card.dfl.error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <ToggleChip on={s.mode === 'existing'} icon="search" onClick={() => s.setMode('existing')}>task existente</ToggleChip>
        <ToggleChip on={s.mode === 'create'} icon="plus" onClick={() => s.setMode('create')}>criar task</ToggleChip>
      </div>
      {s.mode === 'existing' ? (
        <>
          <Input placeholder="buscar task DFL…" value={s.query} onChange={(e) => s.setQuery(e.target.value)} />
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {s.filtered.map((t) => (
              <button
                key={t.id} type="button" disabled={s.busy}
                className="block w-full truncate rounded-sm px-1.5 py-1 text-left text-[11px] text-neutral-300 hover:bg-neutral-800"
                onClick={() => s.link(t.id)}
              >
                {t.name} <span className="text-neutral-600">— {t.deliveryName}</span>
              </button>
            ))}
            {!s.filtered.length && <p className="px-1.5 text-[11px] text-neutral-600">nenhuma task encontrada</p>}
          </div>
        </>
      ) : (
        <>
          <select
            value={s.deliveryPick} onChange={(e) => s.setDeliveryPick(e.target.value)}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[12px] text-neutral-200"
          >
            <option value="">delivery…</option>
            {s.deliveries.map((d) => <option key={`${d.epicId}|${d.deliveryId}`} value={`${d.epicId}|${d.deliveryId}`}>{d.label}</option>)}
          </select>
          <Input placeholder="nome da task" value={s.newTaskName} onChange={(e) => s.setNewTaskName(e.target.value)} />
          <Button size="sm" disabled={s.busy || !s.deliveryPick || !s.newTaskName.trim()} onClick={s.createAndLink}>criar e vincular</Button>
        </>
      )}
      {s.error && <p className="text-[10.5px] text-red-400">{s.error}</p>}
    </div>
  );
}
