import { ProgressBar, tokens } from '../../components/primitives';
import type { NavRow as Row, NavTone } from './nav-model';
import { fmtPts, reaisInt } from './money';
import { NAV_COLS } from './nav-cols';

interface Props {
  row: Row;
  active: boolean;
  marked?: number;        // deliveries of this epic picked for invoicing
  onSelect: (key: string) => void;
}

const DOT: Record<NavTone, string> = {
  draft: 'bg-neutral-500',
  partial: 'bg-orange-400/60',
  dispatched: 'bg-orange-400',
  created: 'bg-green-400',
  open: 'bg-orange-400',
  todo: 'bg-neutral-500',
  paid: 'bg-green-500/70',
};

const LABEL: Record<NavTone, string> = {
  draft: 'rascunho', partial: 'parte enviada', dispatched: 'enviado ao agente', created: 'criado no DFL',
  open: 'tem task aberta', todo: 'tem task a fazer', paid: 'tudo faturado',
};

// One line per epic: status dot, title, pt, R$ and a hairline meter of the R$ 5k
// per-epic cap (yellow when it passes). Tabular mono numbers so columns align.
export function NavRow({ row, active, marked = 0, onSelect }: Props) {
  const pct = Math.min(row.capPct, 100);
  return (
    <button
      type="button" onClick={() => onSelect(row.key)} aria-current={active ? 'true' : undefined}
      title={`${row.context ? `${row.context} › ` : ''}${row.title}\n${LABEL[row.tone]} · ${row.capPct}% do teto por épico`}
      className={`group relative flex h-8 w-full items-center gap-2 rounded-md pl-2.5 pr-2 text-left transition ${tokens.focusRing} ${
        active ? 'bg-orange-500/10 text-neutral-50' : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-neutral-100'}`}
    >
      {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-orange-500" />}
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[row.tone]}`} />
      <span className="min-w-0 flex-1 truncate text-[12.5px]">{row.title}</span>
      {marked > 0 && <span className="shrink-0 rounded bg-orange-500/20 px-1 font-mono text-[10px] text-orange-300">{marked}</span>}
      <span className={`${NAV_COLS.pt} font-mono text-[11.5px] tabular-nums text-neutral-400`}>{fmtPts(row.points)}</span>
      <span className={`${NAV_COLS.brl} font-mono text-[11.5px] tabular-nums text-neutral-500`}>{reaisInt(row.valueCents)}</span>
      <span className={NAV_COLS.cap}>
        <ProgressBar size="xs" segments={[
          { value: pct, tone: row.over ? 'yellow' : row.tone === 'paid' ? 'green' : 'orange' },
          { value: 100 - pct, tone: 'track' },
        ]} />
      </span>
    </button>
  );
}
