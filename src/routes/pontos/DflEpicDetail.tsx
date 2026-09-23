import type { DflEpicNode, DflProjectNode } from '../../../shared/protocol';
import { Badge, Button, ButtonGroup, Icon } from '../../components/primitives';
import { useDflEpic } from './useDflEpic';
import { EpicHeader } from './EpicHeader';
import { CapMeter } from './CapMeter';
import { DflDeliverySection } from './DflDeliverySection';
import { brl, fmtPts } from './money';

interface Props {
  epic: DflEpicNode;
  project: DflProjectNode;
}

// The same Épico → Delivery → Tasks layout as a draft, read-only, with live
// statuses from the last DFL sync. Invoicing starts here: pick deliveries.
export function DflEpicDetail({ epic, project }: Props) {
  const e = useDflEpic(epic);
  const held = e.cap.state === 'held';
  const n = epic.deliveries.length;
  return (
    <div>
      <EpicHeader
        eyebrow={<>
          <span>no dfl</span><span className="text-neutral-700">/</span><span className="normal-case">{project.name}</span>
          {held && <Badge tone="yellow">em espera</Badge>}
        </>}
        title={epic.name}
        figure={brl(epic.amountCents)}
        facts={`${fmtPts(epic.points)} pt · ${e.tasks} tasks · ${n} ${n === 1 ? 'delivery' : 'deliveries'}`}
        meter={<CapMeter valueCents={e.cap.valueCents} capCents={e.cap.capCents} over={held} />}
        actions={e.counts.open > 0 && (
          <ButtonGroup label="fatura">
            <Button variant={e.selecting ? 'secondary' : 'ghost'} size="sm" icon={e.selecting ? 'check' : 'square'} onClick={e.toggleSelecting}>
              {e.selecting ? 'concluir seleção' : 'selecionar deliveries p/ faturar'}
            </Button>
          </ButtonGroup>
        )}
        notice={held && (
          <p className="mt-2.5 flex items-center gap-2 rounded-md border border-yellow-500/25 bg-yellow-500/[0.06] px-2.5 py-1.5 text-[12px] tabular-nums text-yellow-200">
            <Icon name="shield" size={13} className="shrink-0 text-yellow-400" />{e.capText}
          </p>
        )}
      />
      <div className="flex flex-col gap-2.5">
        {epic.deliveries.map((d) => <DflDeliverySection key={d.id} delivery={d} />)}
      </div>
    </div>
  );
}
