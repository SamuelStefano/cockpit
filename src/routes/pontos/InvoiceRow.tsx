import type { DflInvoice } from '../../../shared/protocol';
import { Badge, Icon } from '../../components/primitives';
import { useToggle } from './useToggle';
import { brl, fmtPts, refMonth } from './money';
import { invoiceStatus } from './invoice-status';


export function InvoiceRow({ inv }: { inv: DflInvoice }) {
  const open = useToggle(false);
  const canExpand = inv.items.length > 0;
  const st = invoiceStatus(inv.status);
  return (
    <div>
      <button
        type="button" onClick={open.toggle} disabled={!canExpand} aria-expanded={open.on}
        className="flex h-9 w-full items-center gap-3 px-3 text-left transition hover:bg-neutral-800/30 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Icon name={open.on ? 'chevronDown' : 'chevronRight'} size={12} className={`shrink-0 ${canExpand ? 'text-neutral-500' : 'text-transparent'}`} />
        <span className="w-14 shrink-0 font-mono text-[12.5px] font-semibold tabular-nums text-neutral-100">{refMonth(inv.referenceMonth)}</span>
        <Badge tone={st.tone} dot title={inv.status}>{st.label}</Badge>
        <span className="hidden text-[11.5px] text-neutral-600 sm:inline">{inv.items.length} {inv.items.length === 1 ? 'linha' : 'linhas'}</span>
        <span className="ml-auto shrink-0 font-mono text-[11.5px] tabular-nums text-neutral-500">{fmtPts(inv.totalPoints)} pt</span>
        <span className="w-24 shrink-0 text-right font-mono text-[12.5px] font-medium tabular-nums text-neutral-200">{brl(inv.totalAmountCents)}</span>
      </button>
      {open.on && (
        <div className="divide-y divide-neutral-800/40 border-t border-neutral-800/60 bg-neutral-950/40 pl-9 pr-3">
          {inv.items.map((it, i) => (
            <div key={i} className="flex h-8 items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-300">{it.title}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-500">{fmtPts(it.points)} pt</span>
              <span className="w-24 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-neutral-400">{brl(it.amountCents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
