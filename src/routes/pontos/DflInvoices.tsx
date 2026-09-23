import type { DflInvoice } from '../../../shared/protocol';
import { EmptyState } from '../../components/primitives';
import { InvoiceRow } from './InvoiceRow';
import { brl } from './money';

interface Props {
  invoices: DflInvoice[];
}

// Every DFL invoice as one dense table; a row opens into its lines.
export function DflInvoices({ invoices }: Props) {
  if (!invoices.length) {
    return <EmptyState icon="file" title="Nenhuma fatura" description="As faturas do DFL aparecem aqui após a sincronização." />;
  }
  const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmountCents, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-50">Faturas</h2>
        <span className="font-mono text-[11px] tabular-nums text-neutral-500">{invoices.length} no DFL · {brl(paid)} pagos</span>
      </div>
      <div className="divide-y divide-neutral-800/60 overflow-hidden rounded-lg border border-neutral-800/80 bg-neutral-900/30">
        {invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}
      </div>
    </div>
  );
}
