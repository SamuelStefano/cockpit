import type { DflTotals } from '../../../shared/protocol';
import { InlineEdit, ProgressBar, Stat } from '../../components/primitives';
import { capDetail } from './month-cap';
import type { useMonthSummary } from './useMonthSummary';
import { brl, brlShort, fmtPts, validBrl } from './money';
import type { DraftTotals } from './draft-cap';

interface Props {
  m: ReturnType<typeof useMonthSummary>;
  totals: DflTotals | undefined;
  offPoints: number;
  offAmountCents: number;
  drafts: DraftTotals;
}

const reais = (cents: number): string => String(Math.round(cents) / 100).replace('.', ',');
const CELL = 'lg:flex-1 lg:px-4 lg:first:pl-0';

// The month in one row: what was invoiced, what fits now, what waits, what is
// still to do or staged, and the two knobs (R$/pt, month cap) editable in place.
// The month bar sits under the cap it measures; the full sentence is its tooltip.
export function KpiStrip({ m, totals, offPoints, offAmountCents, drafts }: Props) {
  const { cap } = m;
  if (!cap || !totals) {
    return <p className="border-b border-neutral-800/80 px-4 py-2.5 text-[12px] text-neutral-500">Sem dados do DFL ainda. Sincronize (⟳ no topo) pra ver faturado, em aberto e o teto do mês.</p>;
  }
  const free = Math.max(0, cap.headroomCents - cap.invoiceableCents);
  const bar = (
    <span className="mt-1 block w-full max-w-28" title={capDetail(cap, brl)}>
      <ProgressBar size="xs" segments={[
        { value: cap.billedCents, tone: 'green', label: `faturado no mês: ${brl(cap.billedCents)}` },
        { value: cap.invoiceableCents, tone: 'orange', label: `cabe faturar agora: ${brl(cap.invoiceableCents)}` },
        { value: free, tone: 'track', label: `teto livre: ${brl(free)}` },
      ]} />
    </span>
  );
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-2.5 border-b border-neutral-800/80 px-4 py-2.5 lg:flex lg:divide-x lg:divide-neutral-800/70">
      <Stat compact className={CELL} label="faturado" tone="green" value={brlShort(cap.billedCents)} />
      <Stat compact className={CELL} label="cabe agora" tone="orange" value={brlShort(cap.invoiceableCents)} />
      <Stat compact className={CELL} label="em espera" tone={cap.waitingCents > 0 ? 'yellow' : 'neutral'} value={brlShort(cap.waitingCents)} />
      <Stat compact className={CELL} label="a fazer" value={`${fmtPts(totals.todoPoints)} pt`} />
      <Stat compact className={CELL} label="rascunhos" value={drafts.count ? `${fmtPts(drafts.points)} pt` : '—'} />
      <Stat compact className={CELL} label="valor/ponto" value={
        <InlineEdit label="valor do ponto (R$)" numeric value={reais(m.pointValue * 100)} validate={validBrl} onSave={m.savePointValue}
          display={brlShort(m.pointValue * 100)} inputClassName="w-20 text-[13px]" />} />
      <Stat compact className={CELL} label="teto do mês" sub={bar} value={
        <InlineEdit label="teto do mês (R$)" numeric value={reais(cap.capCents)} validate={validBrl} onSave={m.saveMonthCap}
          display={brlShort(cap.capCents)} inputClassName="w-24 text-[13px]" />} />
      <Stat compact className={CELL} label="já pago" value={<span className="text-neutral-400">{brlShort(totals.paidAmountCents)}</span>} />
      {offPoints > 0 && (
        <Stat compact className={CELL} label="fora do recebível" value={<span className="text-neutral-400" title={brl(offAmountCents)}>{fmtPts(offPoints)} pt</span>} />
      )}
    </div>
  );
}
