import type { DflProjectNode } from '../../../shared/protocol';
import { Button } from '../../components/primitives';
import { brl, fmtPts } from './money';
import { sumDeliveries } from './pontosPrefs';
import { usePontosControls } from './pontosControls';

// Barra da multi-seleção: mostra a soma das deliveries marcadas e as ações (gerar
// invoice, limpar). Aparece só no modo seleção.
export function SelectionBar({ projects, onGenerateInvoice }: { projects: DflProjectNode[]; onGenerateInvoice?: (ids: string[]) => void }) {
  const { selected, clearSelected } = usePontosControls();
  const s = sumDeliveries(projects, selected);
  return (
    <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-neutral-950/90 px-3.5 py-2.5 backdrop-blur">
      <div className="min-w-0 flex-1">
        <span className="text-[12.5px] font-semibold text-neutral-100">{s.count} {s.count === 1 ? 'delivery' : 'deliveries'}</span>
        <span className="ml-2 text-[12px] tabular-nums text-neutral-400">{fmtPts(s.points)} pts · {brl(s.amountCents)}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={clearSelected} disabled={s.count === 0}>limpar</Button>
      <Button variant="primary" size="sm" onClick={() => onGenerateInvoice?.([...selected])} disabled={s.count === 0}>
        gerar invoice
      </Button>
    </div>
  );
}
