import { Badge, ProgressBar } from '../../components/primitives';
import { capDetail, type MonthCap, type MonthCapState } from './month-cap';
import { brl, refMonth } from './money';

const BADGE: Record<MonthCapState, { tone: 'green' | 'yellow' | 'red'; text: string }> = {
  ok: { tone: 'green', text: 'dentro do teto' },
  'at-risk': { tone: 'yellow', text: 'o aberto estoura' },
  over: { tone: 'red', text: 'estourado' },
};

export function MonthCapBar({ cap }: { cap: MonthCap }) {
  const badge = BADGE[cap.state];
  const scale = Math.max(cap.capCents, cap.projectedCents);
  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3.5 py-3 hairline">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-500">Teto de {refMonth(cap.month)}</span>
        <Badge tone={badge.tone} dot>{badge.text}</Badge>
        <span className="ml-auto text-[13px] font-medium tabular-nums text-neutral-200">
          {brl(cap.billedCents)} <span className="text-neutral-500">faturado de {brl(cap.capCents)}</span>
        </span>
      </div>
      <ProgressBar className="mt-2.5" segments={[
        { value: cap.billedCents, tone: 'green', label: `faturado no mês: ${brl(cap.billedCents)}` },
        { value: cap.openCents, tone: 'orange', label: `em aberto: ${brl(cap.openCents)}` },
        { value: scale - cap.projectedCents, tone: 'track', label: `sobra: ${brl(cap.capCents - cap.projectedCents)}` },
      ]} />
      <p className="mt-2 text-[11px] tabular-nums text-neutral-500">{capDetail(cap, brl)}</p>
    </div>
  );
}
