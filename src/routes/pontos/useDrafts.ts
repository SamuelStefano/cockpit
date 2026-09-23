import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DflDraft, DraftOp } from '../../../shared/dfl-drafts';
import { batchDraftNotes, serializeDraftsNote } from '../../../shared/dfl-drafts-note';
import { toast } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { sortDrafts, pendingTotals } from './draft-cap';
import { EPIC_CAP_CENTS } from './epic-cap';
import { currentMonthKey } from './month-cap';

interface Args {
  connected: boolean;
  drafts: DflDraft[];
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
}

const OFFLINE = 'Sem conexão — a alteração não saiu.';

// "Criar no DFL" reuses the free-text agent path (onPontosAgent): the Deck only
// hands the reviewed structure to an agent, it never writes to DFL. Epics are
// packed into as few notes as fit, so "Criar todos" fires one agent, not seven.
export function useDrafts({ connected, drafts, onDraftsGet, onDraftOp }: Args) {
  const { write, pointValue, monthCapCents } = usePontosControls();
  const [confirming, setConfirming] = useState<DflDraft[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (connected) onDraftsGet(); }, [connected, onDraftsGet]);

  const sorted = useMemo(() => sortDrafts(drafts), [drafts]);
  const pending = useMemo(() => sorted.filter((d) => d.status === 'draft'), [sorted]);
  const totals = pendingTotals(drafts, pointValue);

  const op = useCallback((o: DraftOp) => {
    if (!onDraftOp(o)) toast(OFFLINE, { tone: 'error' });
  }, [onDraftOp]);

  const dispatch = useCallback(async () => {
    if (!confirming || busy) return;
    setBusy(true);
    let sent = 0;
    for (const batch of batchDraftNotes(confirming, pointValue)) {
      const r = await write.onPontosAgent({
        note: serializeDraftsNote(batch, pointValue),
        epicCapCents: EPIC_CAP_CENTS,
        monthCapCents: monthCapCents(currentMonthKey(Date.now())),
        pointValue,
      });
      if (!r.ok) { toast(r.message ?? 'Não consegui disparar o agente', { tone: 'error', durationMs: 8000 }); break; }
      for (const d of batch) op({ op: 'set-status', id: d.id, status: 'dispatched' });
      sent += batch.length;
    }
    setBusy(false);
    if (sent) {
      toast(`${sent} ${sent === 1 ? 'épico enviado' : 'épicos enviados'} ao agente — acompanhe em Sessões`);
      setConfirming(null);
    }
  }, [confirming, busy, pointValue, write, monthCapCents, op]);

  return {
    sorted, pending, totals, pointValue, op, busy, confirming, dispatch,
    askDispatch: setConfirming,
    closeConfirm: () => { if (!busy) setConfirming(null); },
  };
}
