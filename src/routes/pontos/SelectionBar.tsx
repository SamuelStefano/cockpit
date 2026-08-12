import { useState } from 'react';
import type { DflProjectNode } from '../../../shared/protocol';
import { Button } from '../../components/primitives';
import { brl, fmtPts } from './money';
import { sumDeliveries } from './pontosPrefs';
import { usePontosControls } from './pontosControls';
import { InvoiceConfirmModal } from './InvoiceConfirmModal';

// Barra da multi-seleção: mostra a soma das deliveries marcadas e as ações (gerar
// invoice, limpar). Aparece só no modo seleção. "gerar invoice" abre a confirmação
// que escreve no DFL prod (uma fatura por delivery, só tasks em aberto).
export function SelectionBar({ projects }: { projects: DflProjectNode[] }) {
  const { selected, clearSelected, pointValue } = usePontosControls();
  const [confirming, setConfirming] = useState(false);
  const s = sumDeliveries(projects, selected, pointValue);
  return (
    <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-neutral-950/90 px-3.5 py-2.5 backdrop-blur">
      <div className="min-w-0 flex-1">
        <span className="text-[12.5px] font-semibold text-neutral-100">{s.count} {s.count === 1 ? 'delivery' : 'deliveries'}</span>
        <span className="ml-2 text-[12px] tabular-nums text-neutral-400">{fmtPts(s.points)} pts · {brl(s.amountCents)}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={clearSelected} disabled={s.count === 0}>limpar</Button>
      <Button variant="primary" size="sm" onClick={() => setConfirming(true)} disabled={s.count === 0}>
        gerar invoice
      </Button>
      {confirming && <InvoiceConfirmModal projects={projects} onClose={() => setConfirming(false)} />}
    </div>
  );
}
