import { useMemo, useState } from 'react';
import type { DflProjectNode } from '../../../shared/protocol';
import { Button } from '../../components/primitives';
import { brl, fmtPts } from './money';
import { selectionSummary } from './invoiceFromSelection';
import { usePontosControls } from './pontosControls';
import { InvoiceConfirmModal } from './InvoiceConfirmModal';

// Barra da multi-seleção: mostra a soma das deliveries marcadas e as ações (gerar
// invoice, limpar). Aparece só no modo seleção. "gerar invoice" abre a confirmação
// que escreve no DFL prod (uma fatura por delivery, só tasks em aberto).
export function SelectionBar({ projects }: { projects: DflProjectNode[] }) {
  const { selected, clearSelected, excluded } = usePontosControls();
  const [confirming, setConfirming] = useState(false);
  // Same drafts the invoice will be built from: only open tasks, at each
  // delivery's own price. Summing every task of the delivery at the UI's R$/pt
  // showed paid and to-do points next to "gerar invoice".
  const s = useMemo(() => selectionSummary(projects, selected, excluded), [projects, selected, excluded]);
  return (
    <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-neutral-950/90 px-3.5 py-2.5 backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        <span className="text-[12.5px] font-semibold text-neutral-100">{s.count} {s.count === 1 ? 'delivery' : 'deliveries'}</span>
        <span className="ml-2 text-[12px] tabular-nums text-neutral-400">{fmtPts(s.points)} pt em aberto · {brl(s.amountCents)}</span>
        {/* "Off" is a per-device flag: say why a selected delivery doesn't count. */}
        {s.off > 0 && <span className="ml-2 text-[11.5px] text-amber-300/80">{s.off} off (fora da fatura)</span>}
      </div>
      <Button variant="ghost" size="sm" onClick={clearSelected} disabled={s.count === 0}>limpar</Button>
      <Button variant="primary" size="sm" onClick={() => setConfirming(true)} disabled={s.billable === 0}>
        gerar invoice
      </Button>
      {confirming && <InvoiceConfirmModal projects={projects} onClose={() => setConfirming(false)} />}
    </div>
  );
}
