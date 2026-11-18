import { useCallback, useEffect, useState } from 'react';
import type { DraftOp, DflDraft } from '../../../shared/dfl-drafts';
import { batchDispatchNotes, serializeDispatchNote, unitMarks, unitTasks, type DispatchUnit } from '../../../shared/dfl-drafts-note';
import { toast } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { EPIC_CAP_CENTS } from './epic-cap';
import { currentMonthKey } from './month-cap';

interface Args {
  connected: boolean;
  drafts: DflDraft[];
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
}

export interface DispatchRequest { title: string; units: DispatchUnit[] }

const OFFLINE = 'Sem conexão — a alteração não saiu.';

// Every "criar no DFL" (whole epic, one delivery, a selection) goes through here:
// ask → confirm dialog with the exact note → the existing agent path
// (onPontosAgent). The Deck only hands over the reviewed structure; it never
// writes to DFL. Units are packed into as few notes as fit (one agent, not seven).
// The confirm dialog holds a snapshot of the units taken when it opened. Another
// tab or the phone may have dispatched the same tasks meanwhile; sending the
// snapshot again would have a second agent create them in DFL. A unit goes only
// if every one of its tasks is still a draft in the LIVE list.
export function unitStillDraft(u: DispatchUnit, drafts: DflDraft[]): boolean {
  const live = drafts.find((d) => d.id === u.draft.id);
  if (!live) return false;
  const status = new Map(live.tasks.map((t) => [t.id, t.status]));
  return unitTasks(u).every((t) => status.get(t.id) === 'draft');
}

export function useDrafts({ connected, drafts, onDraftsGet, onDraftOp }: Args) {
  const { write, pointValue, monthCapCents } = usePontosControls();
  const [confirming, setConfirming] = useState<DispatchRequest | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (connected) onDraftsGet(); }, [connected, onDraftsGet]);

  const op = useCallback((o: DraftOp) => {
    if (!onDraftOp(o)) toast(OFFLINE, { tone: 'error' });
  }, [onDraftOp]);

  const dispatch = useCallback(async () => {
    if (!confirming || busy) return;
    const units = confirming.units.filter((u) => unitStillDraft(u, drafts));
    if (units.length < confirming.units.length) {
      toast('Parte disso já foi enviada de outro lugar — atualizei e não reenviei.', { tone: 'error', durationMs: 8000 });
      setConfirming(null);
      return;
    }
    setBusy(true);
    let sent = 0;
    for (const batch of batchDispatchNotes(units, pointValue)) {
      const r = await write.onPontosAgent({
        note: serializeDispatchNote(batch, pointValue),
        epicCapCents: EPIC_CAP_CENTS,
        monthCapCents: monthCapCents(currentMonthKey(Date.now())),
        pointValue,
      });
      if (!r.ok) { toast(r.message ?? 'Não consegui disparar o agente', { tone: 'error', durationMs: 8000 }); break; }
      op({ op: 'set-status', id: batch.flatMap(unitMarks), status: 'dispatched' });
      sent += batch.reduce((s, u) => s + unitTasks(u).length, 0);
    }
    setBusy(false);
    if (sent) {
      toast(`${sent} ${sent === 1 ? 'task enviada' : 'tasks enviadas'} ao agente — acompanhe em Sessões`);
      setConfirming(null);
    }
  }, [confirming, busy, drafts, pointValue, write, monthCapCents, op]);

  const ask = useCallback((title: string, units: (DispatchUnit | null)[]) => {
    const ok = units.filter((u): u is DispatchUnit => u !== null);
    if (ok.length) setConfirming({ title, units: ok });
    else toast('Nada pendente pra enviar — já foi pro agente.');
  }, []);

  return {
    op, busy, confirming, dispatch, ask, pointValue,
    closeConfirm: () => { if (!busy) setConfirming(null); },
  };
}
