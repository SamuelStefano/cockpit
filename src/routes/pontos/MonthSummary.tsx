import type { DflPointsSnapshot, DflTotals } from '../../../shared/protocol';
import { Badge, Button, ProgressBar, SectionHeader, Stat } from '../../components/primitives';
import { capDetail, type MonthCapState } from './month-cap';
import { useMonthSummary } from './useMonthSummary';
import { MonthSummaryFooter } from './MonthSummaryFooter';
import { brl, fmtPts, refMonth } from './money';

interface Props {
  snapshot: DflPointsSnapshot | null;
  totals: DflTotals | undefined;
  offPoints: number;
  offAmountCents: number;
  now: number;
  syncing: boolean;
  onSync: () => void;
}

const STATE: Record<MonthCapState, { tone: 'green' | 'yellow' | 'red'; text: string }> = {
  ok: { tone: 'green', text: 'dentro do teto' },
  full: { tone: 'yellow', text: 'teto batido' },
  over: { tone: 'red', text: 'teto estourado' },
};

export function MonthSummary({ snapshot, totals, offPoints, offAmountCents, now, syncing, onSync }: Props) {
  const m = useMonthSummary({ snapshot, totals, now });
  const { cap } = m;

  if (!cap || !totals) {
    return (
      <section className="mb-8">
        <SectionHeader title="Resumo do mês" icon="clock" />
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-800 px-3.5 py-4 text-[12.5px] text-neutral-500">
          <span className="flex-1">Sem dados do DFL ainda. Sincronize pra ver faturado, em aberto e o teto do mês.</span>
          <Button variant="secondary" size="sm" icon="rotate" loading={syncing} onClick={onSync}>sincronizar</Button>
        </div>
      </section>
    );
  }

  const st = STATE[cap.state];
  const free = Math.max(0, cap.headroomCents - cap.invoiceableCents);
  return (
    <section className="mb-8">
      <SectionHeader title={`Resumo de ${refMonth(cap.month)}`} icon="clock" actions={<Badge tone={st.tone} dot>{st.text}</Badge>} />
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 hairline">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-3.5 pt-3.5 sm:grid-cols-4">
          <Stat plain label="Faturado no mês" tone="green" value={brl(cap.billedCents)} sub={`de ${brl(cap.capCents)} de teto`} />
          <Stat plain label="Cabe faturar agora" tone="orange" value={brl(cap.invoiceableCents)}
            sub={`de ${brl(cap.openCents)} feitos (${fmtPts(totals.openPoints)} pt)`} />
          <Stat plain label="Em espera" tone={cap.waitingCents > 0 ? 'yellow' : 'neutral'} value={brl(cap.waitingCents)} sub="vai pra um mês seguinte" />
          <Stat plain label="A fazer" value={`${fmtPts(totals.todoPoints)} pt`} sub="tasks ainda abertas" />
        </div>
        <div className="px-3.5 pb-3 pt-3.5">
          <ProgressBar segments={[
            { value: cap.billedCents, tone: 'green', label: `faturado no mês: ${brl(cap.billedCents)}` },
            { value: cap.invoiceableCents, tone: 'orange', label: `cabe faturar agora: ${brl(cap.invoiceableCents)}` },
            { value: free, tone: 'track', label: `teto livre: ${brl(free)}` },
          ]} />
          <p className="mt-2 text-[11.5px] leading-snug tabular-nums text-neutral-500">{capDetail(cap, brl)}</p>
        </div>
        <MonthSummaryFooter m={m} capCents={cap.capCents} totals={totals} offPoints={offPoints} offAmountCents={offAmountCents}
          syncing={syncing} onSync={onSync} />
      </div>
    </section>
  );
}
