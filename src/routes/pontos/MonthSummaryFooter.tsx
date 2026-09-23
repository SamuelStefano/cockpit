import type { DflTotals } from '../../../shared/protocol';
import { Button, InlineEdit } from '../../components/primitives';
import type { useMonthSummary } from './useMonthSummary';
import { brl, fmtPts, validBrl } from './money';

interface Props {
  m: ReturnType<typeof useMonthSummary>;
  capCents: number;
  totals: DflTotals;
  offPoints: number;
  offAmountCents: number;
  syncing: boolean;
  onSync: () => void;
}

const reais = (cents: number): string => String(Math.round(cents) / 100).replace('.', ',');

// The knobs and the context behind the numbers above: R$/pt and the month cap
// (both editable in place), everything already paid, and sync freshness.
export function MonthSummaryFooter({ m, capCents, totals, offPoints, offAmountCents, syncing, onSync }: Props) {
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-800/80 px-3.5 py-2.5 text-[11.5px] text-neutral-500 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 tabular-nums">
        <span className="flex items-center gap-1.5">
          Valor do ponto
          <InlineEdit label="valor do ponto (R$)" numeric value={reais(m.pointValue * 100)} validate={validBrl} onSave={m.savePointValue}
            display={`${brl(m.pointValue * 100)}/pt`} className="font-medium text-neutral-200" inputClassName="w-20 text-[12px]" />
        </span>
        <span className="flex items-center gap-1.5">
          Teto do mês
          <InlineEdit label="teto do mês (R$)" numeric value={reais(capCents)} validate={validBrl} onSave={m.saveMonthCap}
            display={brl(capCents)} className="font-medium text-neutral-200" inputClassName="w-24 text-[12px]" />
        </span>
        <span>
          Já pago <span className="text-neutral-300">{fmtPts(totals.paidPoints)} pt · {brl(totals.paidAmountCents)}</span>
        </span>
        {offPoints > 0 && (
          <span>Fora do recebível <span className="text-neutral-300">{fmtPts(offPoints)} pt · {brl(offAmountCents)}</span></span>
        )}
      </div>
      <div className={`flex shrink-0 items-center gap-1.5 ${m.stale ? 'text-yellow-300' : ''}`}>
        <span>{m.stale ? 'dados velhos — sincronize' : m.syncLabel}</span>
        <Button variant={m.stale ? 'secondary' : 'ghost'} size="sm" square icon="rotate" loading={syncing} onClick={onSync}
          title="Sincronizar com o DFL" aria-label="Sincronizar com o DFL" />
      </div>
    </div>
  );
}
