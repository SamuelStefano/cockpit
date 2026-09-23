import type { DflPointsSnapshot, DflTotals } from '../../../shared/protocol';
import { Button, InlineEdit, ProgressBar, Stat } from '../../components/primitives';
import { capDetail } from './month-cap';
import { useMonthSummary } from './useMonthSummary';
import { brl, brlShort, fmtPts, refMonth, validBrl } from './money';
import type { DraftTotals } from './draft-cap';

interface Props {
  snapshot: DflPointsSnapshot | null;
  totals: DflTotals | undefined;
  offPoints: number;
  offAmountCents: number;
  drafts: DraftTotals;
  now: number;
  syncing: boolean;
  onSync: () => void;
}

const reais = (cents: number): string => String(Math.round(cents) / 100).replace('.', ',');
const CELL = 'lg:px-4 lg:first:pl-0';

// The month in one row: what was invoiced, what fits now, what waits, what is
// still to do or staged, and the two knobs (R$/pt, month cap) editable in place.
// Details live in tooltips so the strip stays one line tall.
export function KpiStrip({ snapshot, totals, offPoints, offAmountCents, drafts, now, syncing, onSync }: Props) {
  const m = useMonthSummary({ snapshot, totals, now });
  const { cap } = m;
  if (!cap || !totals) {
    return (
      <div className="flex items-center gap-3 border-b border-neutral-800/80 px-4 py-2.5 text-[12px] text-neutral-500">
        <span className="flex-1">Sem dados do DFL ainda. Sincronize pra ver faturado, em aberto e o teto do mês.</span>
        <Button variant="secondary" size="sm" icon="rotate" loading={syncing} onClick={onSync}>sincronizar</Button>
      </div>
    );
  }
  const free = Math.max(0, cap.headroomCents - cap.invoiceableCents);
  return (
    <div className="border-b border-neutral-800/80">
      <div className="grid grid-cols-4 gap-x-3 gap-y-2.5 px-4 pb-2 pt-2.5 lg:flex lg:divide-x lg:divide-neutral-800/70">
        <Stat compact className={CELL} label={`faturado ${refMonth(cap.month)}`} tone="green" value={brlShort(cap.billedCents)} />
        <Stat compact className={CELL} label="cabe agora" tone="orange" value={brlShort(cap.invoiceableCents)} />
        <Stat compact className={CELL} label="em espera" tone={cap.waitingCents > 0 ? 'yellow' : 'neutral'} value={brlShort(cap.waitingCents)} />
        <Stat compact className={CELL} label="a fazer" value={`${fmtPts(totals.todoPoints)} pt`} />
        <Stat compact className={CELL} label="rascunhos" value={drafts.count ? `${fmtPts(drafts.points)} pt` : '—'} />
        <Stat compact className={CELL} label="valor do ponto" value={
          <InlineEdit label="valor do ponto (R$)" numeric value={reais(m.pointValue * 100)} validate={validBrl} onSave={m.savePointValue}
            display={`${brlShort(m.pointValue * 100)}/pt`} inputClassName="w-20 text-[13px]" />} />
        <Stat compact className={CELL} label="teto do mês" value={
          <InlineEdit label="teto do mês (R$)" numeric value={reais(cap.capCents)} validate={validBrl} onSave={m.saveMonthCap}
            display={brlShort(cap.capCents)} inputClassName="w-24 text-[13px]" />} />
        <Stat compact className={CELL} label="já pago" tone="neutral" value={<span className="text-neutral-400">{brlShort(totals.paidAmountCents)}</span>} />
        {offPoints > 0 && (
          <Stat compact className={CELL} label="fora do recebível" value={<span className="text-neutral-400" title={brl(offAmountCents)}>{fmtPts(offPoints)} pt</span>} />
        )}
        <div className={`col-span-4 flex items-center justify-end gap-1 text-[11px] lg:col-span-1 lg:ml-auto lg:border-0! lg:pl-4 ${m.stale ? 'text-yellow-300' : 'text-neutral-500'}`}>
          <span className="truncate">{m.stale ? 'dados velhos — sincronize' : m.syncLabel}</span>
          <Button variant={m.stale ? 'secondary' : 'ghost'} size="sm" square icon="rotate" loading={syncing} onClick={onSync}
            title="Sincronizar com o DFL" aria-label="Sincronizar com o DFL" />
        </div>
      </div>
      <div className="px-4 pb-2" title={capDetail(cap, brl)}>
        <ProgressBar size="xs" segments={[
          { value: cap.billedCents, tone: 'green', label: `faturado no mês: ${brl(cap.billedCents)}` },
          { value: cap.invoiceableCents, tone: 'orange', label: `cabe faturar agora: ${brl(cap.invoiceableCents)}` },
          { value: free, tone: 'track', label: `teto livre: ${brl(free)}` },
        ]} />
      </div>
    </div>
  );
}
