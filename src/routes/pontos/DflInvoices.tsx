import { useState } from 'react';
import type { DflInvoice } from '../../../shared/protocol';
import { Badge, EmptyState, Icon } from '../../components/primitives';
import { brl, fmtPts, refMonth } from './money';

interface Props {
  invoices: DflInvoice[];
}

function tone(status: string): 'green' | 'orange' | 'neutral' {
  if (status === 'paid') return 'green';
  if (status === 'pending' || status === 'open') return 'orange';
  return 'neutral';
}

function InvoiceRow({ inv }: { inv: DflInvoice }) {
  const [open, setOpen] = useState(false);
  const canExpand = inv.items.length > 0;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 hairline">
      <button
        onClick={() => canExpand && setOpen((v) => !v)}
        disabled={!canExpand}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left disabled:cursor-default"
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} className={`shrink-0 ${canExpand ? 'text-neutral-600' : 'text-transparent'}`} />
        <span className="w-16 shrink-0 text-[13px] font-semibold tabular-nums text-neutral-100">{refMonth(inv.referenceMonth)}</span>
        <Badge tone={tone(inv.status)} dot>{inv.status}</Badge>
        <span className="ml-auto shrink-0 text-[12px] tabular-nums text-neutral-500">{fmtPts(inv.totalPoints)} pts</span>
        <span className="w-28 shrink-0 text-right text-[13px] font-medium tabular-nums text-neutral-200">{brl(inv.totalAmountCents)}</span>
      </button>
      {open && (
        <div className="border-t border-neutral-800/60 px-2.5 py-1 pl-8">
          <div className="divide-y divide-neutral-800/40">
            {inv.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-300">{it.title}</span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-neutral-500">{fmtPts(it.points)} pts</span>
                <span className="w-24 shrink-0 text-right text-[12px] tabular-nums text-neutral-300">{brl(it.amountCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DflInvoices({ invoices }: Props) {
  if (!invoices.length) {
    return <EmptyState icon="file" title="Nenhuma fatura" description="As faturas do DFL aparecem aqui após a sincronização." />;
  }
  return (
    <div className="space-y-2">
      {invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}
    </div>
  );
}
