import type { DflTotals } from '../../../shared/protocol';
import { Stat, ProgressBar } from '../../components/primitives';
import { brl, fmtPts } from './money';

interface Props {
  totals: DflTotals;
  offPoints?: number;
  offAmountCents?: number;
}

// Resumo financeiro: Pago / Em aberto / A fazer (pontos + R$) e uma barra
// proporcional. "Aberto" = task done ainda não faturada; "a fazer" = não concluída.
// "Off" = deliveries feitas que você tirou do recebível (não fatura agora).
export function FinanceSummaryBar({ totals, offPoints = 0, offAmountCents = 0 }: Props) {
  const { paidPoints, paidAmountCents, openPoints, amountOpenCents, todoPoints } = totals;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Pago" value={`${fmtPts(paidPoints)} pts`} sub={brl(paidAmountCents)} icon="check" tone="green" />
        <Stat label="Em aberto" value={`${fmtPts(openPoints)} pts`} sub={brl(amountOpenCents)} icon="clock" tone="orange" />
        <Stat label="A fazer" value={`${fmtPts(todoPoints)} pts`} sub="estimativa futura" icon="square" tone="neutral" />
      </div>
      {offPoints > 0 && (
        <p className="mt-2 text-[11px] tabular-nums text-neutral-500">
          <span className="text-neutral-400">{fmtPts(offPoints)} pts · {brl(offAmountCents)}</span> fora do recebível (deliveries em off)
        </p>
      )}
      <ProgressBar className="mt-3" segments={[
        { value: paidPoints, tone: 'green', label: `pago: ${paidPoints} pts` },
        { value: openPoints, tone: 'orange', label: `aberto: ${openPoints} pts` },
        { value: todoPoints, tone: 'neutral', label: `a fazer: ${todoPoints} pts` },
      ]} />
    </div>
  );
}
