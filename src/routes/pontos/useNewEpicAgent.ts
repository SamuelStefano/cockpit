import { useState } from 'react';
import { toast } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { currentMonthKey } from './month-cap';
import { EPIC_CAP_CENTS } from './epic-cap';

export type AgentTarget = 'drafts' | 'dfl';

// "Novo épico com agente": free text → an agent. By default it only STAGES the
// structure in the Deck (deck-drafts), so nothing reaches DFL before Samuel's
// review; writing straight to DFL is the explicit second option.
export function useNewEpicAgent(onClose: () => void) {
  const { write, pointValue, monthCapCents } = usePontosControls();
  const [note, setNote] = useState('');
  const [target, setTarget] = useState<AgentTarget>('drafts');
  const [busy, setBusy] = useState(false);
  const monthCap = monthCapCents(currentMonthKey(Date.now()));

  const fire = async () => {
    if (busy) return;
    setBusy(true);
    const r = await write.onPontosAgent({ note, epicCapCents: EPIC_CAP_CENTS, monthCapCents: monthCap, pointValue, target });
    setBusy(false);
    if (!r.ok) { toast(r.message ?? 'não consegui disparar o agente', { tone: 'error', durationMs: 8000 }); return; }
    toast(target === 'drafts' ? 'Agente montando o rascunho — ele aparece aqui quando terminar' : 'Agente disparado — acompanhe em Sessões');
    onClose();
  };

  return { note, setNote, target, setTarget, busy, fire, monthCap, close: busy ? () => {} : onClose };
}
