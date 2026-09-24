import { useCallback, useEffect, useState } from 'react';
import type { DraftOp } from '../../../shared/dfl-drafts';
import { batchDispatchNotes, serializeDispatchNote, unitMarks, unitTasks, type DispatchUnit } from '../../../shared/dfl-drafts-note';
import { toast } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { EPIC_CAP_CENTS } from './epic-cap';
import { currentMonthKey } from './month-cap';

interface Args {
  connected: boolean;
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
}

export interface DispatchRequest { title: string; units: DispatchUnit[] }

const OFFLINE = 'Sem conexão — a alteração não saiu.';

// Every "criar no DFL" (whole epic, one delivery, a selection) goes through here:
// ask → confirm dialog with the exact note → the existing agent path
// (onPontosAgent). The Deck only hands over the reviewed structure; it never
// writes to DFL. Units are packed into as few notes as fit (one agent, not seven).
export function useDrafts({ connected, onDraftsGet, onDraftOp }: Args) {
  const { write, pointValue, monthCapCents } = usePontosControls();
  const [confirming, setConfirming] = useState<DispatchRequest | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (connected) onDraftsGet(); }, [connected, onDraftsGet]);

  const op = useCallback((o: DraftOp) => {
    if (!onDraftOp(o)) toast(OFFLINE, { tone: 'error' });
  }, [onDraftOp]);

  const dispatch = useCallback(async () => {
    if (!confirming || busy) return;
    setBusy(true);
    let sent = 0;
    for (const batch of batchDispatchNotes(confirming.units, pointValue)) {
      const r = await write.onPontosAgent({
        note: serializeDispatchNote(batch, pointValue),
        epicCapCents: EPIC_CAP_CENTS,
        monthCapCents: monthCapCents(currentMonthKey(Date.now())),
        pointValue,
      });
      // Sent but no reply in time: the agent may already be creating these tasks in
      // DFL. Mark them dispatched and close, so "Disparar" can't fire a second agent.
      if (!r.ok && r.unknown) {
        op({ op: 'set-status', id: batch.flatMap(unitMarks), status: 'dispatched' });
        toast('Sem resposta a tempo — o agente pode estar rodando. Confira em Sessões antes de disparar de novo.', { tone: 'error', durationMs: 10000 });
        setConfirming(null);
        break;
      }
      if (!r.ok) { toast(r.message ?? 'Não consegui disparar o agente', { tone: 'error', durationMs: 8000 }); break; }
      op({ op: 'set-status', id: batch.flatMap(unitMarks), status: 'dispatched' });
      sent += batch.reduce((s, u) => s + unitTasks(u).length, 0);
    }
    setBusy(false);
    if (sent) {
      toast(`${sent} ${sent === 1 ? 'task enviada' : 'tasks enviadas'} ao agente — acompanhe em Sessões`);
      setConfirming(null);
    }
  }, [confirming, busy, pointValue, write, monthCapCents, op]);

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
