import type { DflEpicNode } from '../../../shared/protocol';
import { Badge } from '../../components/primitives';
import { DflDelivery } from './DflDelivery';
import { usePontosControls } from './pontosControls';
import { epicCap, epicCapDetail } from './epic-cap';
import { brl, fmtPts } from './money';
import { redundantEpicHeader } from './treeFilter';

// Um épico da árvore. O header some quando é redundante com a delivery única —
// EXCETO se o épico passou do teto: aí ele é a única coisa que carrega o aviso de
// "em espera", e esconder isso apagaria a regra da tela.
export function DflEpic({ epic, expandAll }: { epic: DflEpicNode; expandAll: boolean }) {
  const { pointValue, excluded } = usePontosControls();
  const cap = epicCap(epic, { pointValue, excluded });
  const held = cap.state === 'held';
  const showHeader = held || !redundantEpicHeader(epic);
  return (
    <div>
      {showHeader && (
        <div className="px-0.5 py-1">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold uppercase tracking-widest text-neutral-500">{epic.name}</span>
            {held && <Badge tone="yellow">em espera</Badge>}
            <span className="shrink-0 text-[10.5px] tabular-nums text-neutral-600">{fmtPts(epic.points)} pts · {brl(epic.amountCents)}</span>
          </div>
          {held && <p className="mt-1 text-[10.5px] tabular-nums text-yellow-300/80">{epicCapDetail(cap, brl)}</p>}
        </div>
      )}
      <div className="space-y-1.5">
        {/* key inclui o modo: trocar o filtro remonta e reaplica o defaultOpen */}
        {epic.deliveries.map((d) => <DflDelivery key={`${d.id}:${expandAll}`} delivery={d} defaultOpen={expandAll} />)}
      </div>
    </div>
  );
}
