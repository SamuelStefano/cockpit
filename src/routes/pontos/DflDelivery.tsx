import { useState } from 'react';
import type { DflDeliveryNode } from '../../../shared/protocol';
import { Badge, Icon } from '../../components/primitives';
import { TaskRow } from './TaskRow';
import { brl, fmtPts } from './money';
import { deliveryCounts } from './treeFilter';
import { usePontosControls } from './pontosControls';

// Delivery colapsada por padrão: o resumo (chips por status + pts + R$) responde
// "o que tem aqui?" sem abrir; expandir mostra as tasks. O botão off tira a delivery
// do recebível (trabalho feito que ainda não pode ser faturado).
export function DflDelivery({ delivery, defaultOpen = false }: { delivery: DflDeliveryNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { excluded, toggleExcluded, selecting, selected, toggleSelected } = usePontosControls();
  const off = excluded.has(delivery.id);
  const picked = selected.has(delivery.id);
  const c = deliveryCounts(delivery);
  const canToggle = c.open > 0;
  return (
    <div className={`rounded-lg border bg-neutral-900/30 ${picked ? 'border-orange-500/40' : off ? 'border-neutral-800/50 opacity-55' : 'border-neutral-800/80'}`}>
      <div className="flex w-full items-center gap-2 px-2.5 py-2">
        {selecting && (
          <button onClick={() => toggleSelected(delivery.id)} title={picked ? 'Desmarcar' : 'Marcar'}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
              picked ? 'border-orange-500 bg-orange-500 text-neutral-950' : 'border-neutral-600 text-transparent hover:border-neutral-400'}`}>
            <Icon name="check" size={11} />
          </button>
        )}
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} className="shrink-0 text-neutral-600" />
          <span className={`min-w-0 flex-1 truncate text-[12.5px] ${off ? 'text-neutral-400 line-through' : 'text-neutral-200'}`}>{delivery.name}</span>
        </button>
        {off && <Badge tone="neutral">off</Badge>}
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          {c.paid > 0 && <Badge tone="green">{c.paid} paga{c.paid > 1 ? 's' : ''}</Badge>}
          {c.open > 0 && <Badge tone="orange">{c.open} aberta{c.open > 1 ? 's' : ''}</Badge>}
          {c.todo > 0 && <Badge tone="neutral">{c.todo} a fazer</Badge>}
        </span>
        <span className="w-14 shrink-0 text-right text-[12px] font-medium tabular-nums text-neutral-300">{fmtPts(delivery.points)} pts</span>
        <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-500">{brl(delivery.amountCents)}</span>
        {canToggle && (
          <button
            onClick={() => toggleExcluded(delivery.id)}
            title={off ? 'Voltar pro recebível' : 'Tirar do recebível (off)'}
            className={`shrink-0 rounded-md p-1 transition ${off ? 'text-neutral-500 hover:text-orange-300' : 'text-neutral-600 hover:text-neutral-300'}`}
          >
            <Icon name={off ? 'circle' : 'check'} size={13} />
          </button>
        )}
      </div>
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
