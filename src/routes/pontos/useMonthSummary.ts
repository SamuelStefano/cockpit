import type { DflPointsSnapshot, DflTotals } from '../../../shared/protocol';
import { toast } from '../../components/primitives';
import { relPast } from '../../../shared/format';
import { usePontosControls } from './pontosControls';
import { monthCap, currentMonthKey } from './month-cap';
import { brl, parseBrl } from './money';

interface Args {
  snapshot: DflPointsSnapshot | null;
  totals: DflTotals | undefined;
  now: number;
}

// One summary instead of four bars: the month cap (what can still be invoiced),
// the receivable split into "fits now" and "waits", plus the two knobs (R$/pt and
// the month cap) and sync freshness as a footer.
export function useMonthSummary({ snapshot, totals, now }: Args) {
  const { pointValue, setPointValue, monthCapCents, setMonthCapCents } = usePontosControls();
  const month = currentMonthKey(now);
  const cap = snapshot && totals ? monthCap(snapshot.invoices, totals.amountOpenCents, now, monthCapCents(month)) : null;
  const synced = snapshot ? relPast(snapshot.syncedAt, now) : '';

  const savePointValue = (v: string) => {
    const n = Math.round(parseBrl(v) * 100) / 100;
    setPointValue(n);
    toast(`Valor do ponto: ${brl(n * 100)} — recebível recalculado; o que já foi pago não muda`);
  };
  const saveMonthCap = (v: string) => setMonthCapCents(month, Math.round(parseBrl(v) * 100));

  return {
    cap,
    pointValue,
    savePointValue,
    saveMonthCap,
    stale: snapshot?.stale ?? false,
    syncLabel: !snapshot ? 'sem dados do DFL' : synced === 'agora' ? 'sincronizado agora' : `sincronizado há ${synced}`,
  };
}
