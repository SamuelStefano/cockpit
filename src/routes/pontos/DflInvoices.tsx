import type { DflInvoice } from '../../../shared/protocol';
import { Badge, EmptyState } from '../../components/primitives';
import { brl, refMonth } from './money';

interface Props {
  invoices: DflInvoice[];
}

function tone(status: string): 'green' | 'orange' | 'neutral' {
  if (status === 'paid') return 'green';
  if (status === 'pending' || status === 'open') return 'orange';
  return 'neutral';
}

export function DflInvoices({ invoices }: Props) {
  if (!invoices.length) {
    return <EmptyState icon="file" title="Nenhuma fatura" description="As faturas do DFL aparecem aqui após a sincronização." />;
  }
  return (
    <div className="space-y-2">
      {invoices.map((inv) => (
        <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3.5 py-2.5 hairline">
          <span className="w-16 shrink-0 text-[13px] font-semibold tabular-nums text-neutral-100">{refMonth(inv.referenceMonth)}</span>
          <Badge tone={tone(inv.status)} dot>{inv.status}</Badge>
          <span className="ml-auto shrink-0 text-[12px] tabular-nums text-neutral-500">{inv.totalPoints} pts</span>
          <span className="w-28 shrink-0 text-right text-[13px] font-medium tabular-nums text-neutral-200">{brl(inv.totalAmountCents)}</span>
        </div>
      ))}
    </div>
  );
}
