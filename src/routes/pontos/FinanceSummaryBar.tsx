import type { DflTotals } from '../../../shared/protocol';
import { Stat, ProgressBar } from '../../components/primitives';
import { brl } from './money';

interface Props {
  totals: DflTotals;
}

// Resumo financeiro: Pago / Em aberto / A fazer (pontos + R$) e uma barra
// proporcional. "Aberto" = task done ainda não faturada; "a fazer" = não concluída.
export function FinanceSummaryBar({ totals }: Props) {
  const { paidPoints, paidAmountCents, openPoints, amountOpenCents, todoPoints } = totals;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Pago" value={`${paidPoints} pts`} sub={brl(paidAmountCents)} icon="check" tone="green" />
        <Stat label="Em aberto" value={`${openPoints} pts`} sub={brl(amountOpenCents)} icon="clock" tone="orange" />
        <Stat label="A fazer" value={`${todoPoints} pts`} sub="estimativa futura" icon="square" tone="neutral" />
      </div>
      <ProgressBar className="mt-3" segments={[
        { value: paidPoints, tone: 'green', label: `pago: ${paidPoints} pts` },
        { value: openPoints, tone: 'orange', label: `aberto: ${openPoints} pts` },
        { value: todoPoints, tone: 'neutral', label: `a fazer: ${todoPoints} pts` },
      ]} />
    </div>
  );
}
