import { tokens } from '../primitives';
import { relReset } from '../../lib/time';
import type { UsageRow } from './usage-rows';

const BAR: Record<UsageRow['tone'], string> = {
  ok: 'bg-emerald-500',
  mid: 'bg-amber-500',
  high: 'bg-red-500',
};

const TEXT: Record<UsageRow['tone'], string> = {
  ok: 'text-emerald-300',
  mid: 'text-amber-300',
  high: 'text-red-300',
};

function Row({ row }: { row: UsageRow }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[12px] font-medium text-neutral-200">
          {row.label}
          {row.scoped && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-neutral-500">modelo</span>}
        </span>
        <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${TEXT[row.tone]}`}>{row.pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <div className={`h-full rounded-full transition-all ${BAR[row.tone]}`} style={{ width: `${row.pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-neutral-500">
        {row.resetsAt ? `reseta em ${relReset(row.resetsAt)}` : 'sem reset agendado'}
      </span>
    </li>
  );
}

// `reset` vem do gate de cota (não das linhas): é o "quando volto a poder enviar"
// que a pílula flutuante mostrava antes de sair do chat.
export function UsagePanel({ rows, reset = '', warn = false }: { rows: UsageRow[]; reset?: string; warn?: boolean }) {
  return (
    <div
      role="dialog"
      aria-label="Detalhe do uso do plano"
      className={`absolute right-0 top-full z-50 mt-2 w-64 ${tokens.radius.lg} ${tokens.surface.raised} p-3.5`}
    >
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Uso do plano</p>
      {rows.length === 0 ? (
        <p className="text-[12px] text-neutral-500">Lendo da conta…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}
      {reset && (
        <p className={`mt-3 border-t border-neutral-800 pt-2.5 text-[11px] tabular-nums ${warn ? 'text-amber-300/90' : 'text-neutral-500'}`}>
          reseta {reset}
        </p>
      )}
    </div>
  );
}
