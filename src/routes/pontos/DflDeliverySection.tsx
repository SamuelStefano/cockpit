import type { DflDeliveryNode } from '../../../shared/protocol';
import { Badge, Button, Checkbox, Icon } from '../../components/primitives';
import { useDflDelivery } from './useDflDelivery';
import { DflTaskRow } from './DflTaskRow';
import { brl, brlShort, fmtPts } from './money';

// A DFL delivery: header with the invoice pick (selection mode), status counts,
// totals and the "off" switch that takes done work out of the receivable; then
// its tasks as a table. Fully paid deliveries start folded: they are history.
export function DflDeliverySection({ delivery, defaultOpen }: { delivery: DflDeliveryNode; defaultOpen: boolean }) {
  const v = useDflDelivery(delivery, defaultOpen);
  const c = v.counts;
  return (
    <section aria-label={delivery.name}
      className={`overflow-hidden rounded-lg border ${v.picked ? 'border-orange-500/50' : 'border-neutral-800/80'} ${v.off ? 'opacity-60' : ''} bg-neutral-900/30`}>
      <div className={`flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-1 bg-neutral-900/50 px-2.5 py-1 ${v.open ? 'border-b border-neutral-800/70' : ''}`}>
        {v.selecting && c.open > 0 && <Checkbox checked={v.picked} onChange={v.togglePick} label={`Faturar ${delivery.name}`} />}
        <button type="button" onClick={v.toggleOpen} aria-expanded={v.open} className="flex min-w-0 items-center gap-2 text-left">
          <Icon name={v.open ? 'chevronDown' : 'chevronRight'} size={12} className="shrink-0 text-neutral-500" />
          <span className={`min-w-0 truncate text-[12.5px] font-medium ${v.off ? 'text-neutral-400 line-through' : 'text-neutral-100'}`}>{delivery.name}</span>
        </button>
        <span className="flex items-center gap-1">
          {c.paid > 0 && <Badge tone="green">{c.paid} paga{c.paid > 1 ? 's' : ''}</Badge>}
          {c.open > 0 && <Badge tone="orange">{c.open} aberta{c.open > 1 ? 's' : ''}</Badge>}
          {c.todo > 0 && <Badge>{c.todo} a fazer</Badge>}
          {v.off && <Badge>off</Badge>}
        </span>
        <span className="ml-auto flex items-center gap-2 font-mono text-[11px] tabular-nums text-neutral-500">
          <span className="text-neutral-300">{fmtPts(delivery.points)} pt</span>
          <span>{brlShort(delivery.amountCents)}</span>
          <span className="hidden text-neutral-600 sm:inline">{brl(delivery.pricePerPoint * 100)}/pt</span>
          {c.open > 0 && (
            <Button variant="ghost" size="xs" square icon={v.off ? 'circle' : 'check'} onClick={v.toggleOff}
              title={v.off ? 'Voltar pro recebível' : 'Tirar do recebível (off)'} aria-label={v.off ? 'Voltar pro recebível' : 'Tirar do recebível'} />
          )}
        </span>
      </div>
      {v.open && (
        <ul className="divide-y divide-neutral-800/50">
          {v.live.map((t) => <DflTaskRow key={t.id} task={t} />)}
          {v.tuckPaid && (
            <li>
              <button type="button" onClick={v.togglePaid} aria-expanded={v.showPaid}
                className="flex h-8 w-full items-center gap-2 px-2.5 text-left font-mono text-[11px] text-neutral-500 hover:bg-neutral-800/30 hover:text-neutral-300">
                <Icon name={v.showPaid ? 'chevronDown' : 'chevronRight'} size={11} />
                {v.showPaid ? 'esconder' : 'mostrar'} {v.paid.length} {v.paid.length === 1 ? 'paga' : 'pagas'} · {fmtPts(v.paidPoints)} pt
              </button>
            </li>
          )}
          {v.showPaid && v.paid.map((t) => <DflTaskRow key={t.id} task={t} />)}
        </ul>
      )}
    </section>
  );
}
