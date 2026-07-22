import { useState } from 'react';
import type { DflDeliveryNode } from '../../../shared/protocol';
import { Badge, Icon } from '../../components/primitives';
import { TaskRow } from './TaskRow';
import { brl, fmtPts } from './money';
import { deliveryCounts } from './treeFilter';

// Delivery colapsada por padrão: o resumo (chips por status + pts + R$) responde
// "o que tem aqui?" sem abrir; expandir mostra as tasks.
export function DflDelivery({ delivery, defaultOpen = false }: { delivery: DflDeliveryNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const c = deliveryCounts(delivery);
  return (
    <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/30">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} className="shrink-0 text-neutral-600" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-neutral-200">{delivery.name}</span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          {c.paid > 0 && <Badge tone="green">{c.paid} paga{c.paid > 1 ? 's' : ''}</Badge>}
          {c.open > 0 && <Badge tone="orange">{c.open} aberta{c.open > 1 ? 's' : ''}</Badge>}
          {c.todo > 0 && <Badge tone="neutral">{c.todo} a fazer</Badge>}
        </span>
        <span className="w-14 shrink-0 text-right text-[12px] font-medium tabular-nums text-neutral-300">{fmtPts(delivery.points)} pts</span>
        <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-500">{brl(delivery.amountCents)}</span>
      </button>
      {open && (
        <div className="border-t border-neutral-800/60 px-2 py-1">
          <div className="flex items-center justify-end px-2 py-1 text-[10.5px] tabular-nums text-neutral-600">{brl(delivery.pricePerPoint * 100)}/pt nesta delivery</div>
          <div className="divide-y divide-neutral-800/40">
            {delivery.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}
