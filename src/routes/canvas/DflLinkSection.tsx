import { useState } from 'react';
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
  onCreateLink: (cardId: string, taskName: string, epicId: string, deliveryId: string, why: string, what: string) => Promise<DflWriteResult>;
  onUnlink: (cardId: string) => boolean;
  // review/done feed DFL's billing surface — the server never pushes those
  // automatically (statusNeedsHumanConfirm/shared/canvas.ts); this is the
  // one explicit action that does, gated the same way client- and server-side.
  onConfirmSync: (cardId: string) => Promise<DflWriteResult>;
}

// CardEditor's "vincular à task DFL" — opt-in per card, never automatic. Only
// rendered at all for a card already linked (so unlinking always stays
// reachable even if the card's area drifted) or one whose area IS 'dfl' for
// EVERY linked context/session (server/canvas/dfl-link.ts — recomputed
// server-side; a card here linking still goes through the server's own
// unanimous-area + confirm guard, this is only the affordance).
export function DflLinkSection({ card, isDflArea, snapshot, onLink, onCreateLink, onUnlink, onConfirmSync }: Props) {
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
        {card.dfl.awaitingConfirm && (
          <div className="mt-1.5 rounded-sm border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5">
            {/* Two cases share this same gate (server/canvas/dfl-status-sync.ts):
                reaching Done/Completed (billable), OR moving a card AWAY from
                a status DFL already has as dev_completed/done — reopening a
                possibly-invoiced task. Generic wording covers both without
                the UI needing to know which one triggered it. */}
            <p className="text-[10.5px] text-yellow-300">
              Essa mudança de status é faturável ou reabre uma task já concluída na DFL. Confirme pra sincronizar.
            </p>
            <ConfirmSync cardId={card.id} onConfirmSync={onConfirmSync} />
          </div>
        )}
        {card.dfl.error && !card.dfl.awaitingConfirm && <p className="mt-1 text-[10.5px] text-red-400">sync pendente: {card.dfl.error}</p>}
      </div>
    );
  }

  // Step 2: review + explicit confirm — the ONLY moment either write fires.
  // Shows the EXACT payload the server will receive (title/why/what for a
  // new task; just the picked title for a link), never a guess at it.
  if (s.pending) {
    return (
      <div className="rounded-lg border border-orange-500/40 bg-neutral-950 px-2.5 py-2 space-y-2">
        <p className="text-[10.5px] font-medium uppercase tracking-wide text-orange-400">confirmar antes de enviar pra DFL</p>
        {s.pending.kind === 'link' ? (
          <p className="text-[12px] text-neutral-200">Vincular este card à task <strong>{s.pending.taskName}</strong>?</p>
        ) : (
          <div className="space-y-1 text-[12px] text-neutral-200">
            <p>Criar task <strong>{s.pending.taskName}</strong> em <span className="text-neutral-400">{s.pending.deliveryLabel}</span>:</p>
            <p className="text-neutral-400">por quê: <span className="text-neutral-200">{s.pending.why}</span></p>
            <p className="text-neutral-400">o que: <span className="text-neutral-200">{s.pending.what}</span></p>
          </div>
        )}
        <p className="text-[10.5px] text-neutral-500">Isso fica visível pra qualquer pessoa com acesso à DFL. Nada do prompt do card é enviado.</p>
        {s.error && <p className="text-[10.5px] text-red-400">{s.error}</p>}
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={s.cancelReview} disabled={s.busy}>cancelar</Button>
          <Button size="sm" disabled={s.busy} loading={s.busy} onClick={s.confirm}>confirmar e enviar</Button>
        </div>
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
                key={t.id} type="button"
                className="block w-full truncate rounded-sm px-1.5 py-1 text-left text-[11px] text-neutral-300 hover:bg-neutral-800"
                onClick={() => s.review(t.id)}
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
          <Input placeholder="por quê (obrigatório, fica visível na DFL)" value={s.why} onChange={(e) => s.setWhy(e.target.value)} />
          <Input placeholder="o que (obrigatório, fica visível na DFL)" value={s.what} onChange={(e) => s.setWhat(e.target.value)} />
          <Button size="sm" disabled={!s.deliveryPick || !s.newTaskName.trim() || !s.why.trim() || !s.what.trim()} onClick={s.reviewCreate}>
            revisar
          </Button>
        </>
      )}
      {s.error && <p className="text-[10.5px] text-red-400">{s.error}</p>}
    </div>
  );
}

// The editor's `card` is a snapshot taken when it opened, so the yellow banner
// never cleared by itself after a confirm, and the button had no busy state or
// error: it invited repeated clicks on a billable push. Local state closes the
// loop: busy while the ack is pending, "enviado" once queued, the error if not.
function ConfirmSync({ cardId, onConfirmSync }: { cardId: string; onConfirmSync: (cardId: string) => Promise<DflWriteResult> }) {
  const [state, setState] = useState<{ busy: boolean; done: boolean; error?: string }>({ busy: false, done: false });
  if (state.done) return <p className="mt-1 text-[10.5px] text-emerald-300">enviado — sincronizando com a DFL</p>;
  const run = async () => {
    if (state.busy) return;
    setState({ busy: true, done: false });
    const r = await onConfirmSync(cardId);
    setState(r.ok ? { busy: false, done: true } : { busy: false, done: false, error: r.message ?? 'falhou' });
  };
  return (
    <>
      <Button size="xs" className="mt-1" onClick={run} loading={state.busy} disabled={state.busy}>confirmar sync</Button>
      {state.error && <p className="mt-1 text-[10.5px] text-red-400">{state.error}</p>}
    </>
  );
}
