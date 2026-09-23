import type { DflDeliveryNode } from '../../../shared/protocol';
import { Badge, Button, Checkbox } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { deliveryCounts } from './treeFilter';
import { DflTaskRow } from './DflTaskRow';
import { brl, brlShort, fmtPts } from './money';

// A DFL delivery: header with the invoice pick (selection mode), status counts,
// totals and the "off" switch that takes done work out of the receivable; then
// its tasks as a table.
export function DflDeliverySection({ delivery }: { delivery: DflDeliveryNode }) {
  const { excluded, toggleExcluded, selecting, selected, toggleSelected } = usePontosControls();
  const off = excluded.has(delivery.id);
  const picked = selected.has(delivery.id);
  const c = deliveryCounts(delivery);
  return (
    <section aria-label={delivery.name}
      className={`overflow-hidden rounded-lg border ${picked ? 'border-orange-500/50' : 'border-neutral-800/80'} ${off ? 'opacity-60' : ''} bg-neutral-900/30`}>
      <div className="flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-neutral-800/70 bg-neutral-900/50 px-2.5 py-1">
        {selecting && c.open > 0 && <Checkbox checked={picked} onChange={() => toggleSelected(delivery.id)} label={`Faturar ${delivery.name}`} />}
        <span className="font-mono text-[10px] lowercase tracking-wide text-neutral-600">delivery</span>
        <span className={`min-w-0 truncate text-[12.5px] font-medium ${off ? 'text-neutral-400 line-through' : 'text-neutral-100'}`}>{delivery.name}</span>
        <span className="flex items-center gap-1">
          {c.paid > 0 && <Badge tone="green">{c.paid} paga{c.paid > 1 ? 's' : ''}</Badge>}
          {c.open > 0 && <Badge tone="orange">{c.open} aberta{c.open > 1 ? 's' : ''}</Badge>}
          {c.todo > 0 && <Badge>{c.todo} a fazer</Badge>}
          {off && <Badge>off</Badge>}
        </span>
        <span className="ml-auto flex items-center gap-2 font-mono text-[11px] tabular-nums text-neutral-500">
          <span className="text-neutral-300">{fmtPts(delivery.points)} pt</span>
          <span>{brlShort(delivery.amountCents)}</span>
          <span className="hidden text-neutral-600 sm:inline">{brl(delivery.pricePerPoint * 100)}/pt</span>
          {c.open > 0 && (
            <Button variant="ghost" size="xs" square icon={off ? 'circle' : 'check'} onClick={() => toggleExcluded(delivery.id)}
              title={off ? 'Voltar pro recebível' : 'Tirar do recebível (off)'} aria-label={off ? 'Voltar pro recebível' : 'Tirar do recebível'} />
          )}
        </span>
      </div>
      <ul className="divide-y divide-neutral-800/50">
        {delivery.tasks.map((t) => <DflTaskRow key={t.id} task={t} />)}
      </ul>
    </section>
  );
}
