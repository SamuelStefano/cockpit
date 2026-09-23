import type { DflEpicNode } from '../../../shared/protocol';
import { usePontosControls } from './pontosControls';
import { epicCap, epicCapDetail } from './epic-cap';
import { deliveryCounts } from './treeFilter';
import { brl } from './money';

// Derived view of a DFL epic: the per-epic cap over the whole epic (paid + open),
// task counts per status, and the invoice-selection mode toggle.
export function useDflEpic(epic: DflEpicNode) {
  const { pointValue, excluded, selecting, setSelecting, clearSelected } = usePontosControls();
  const cap = epicCap(epic, { pointValue, excluded });
  const counts = epic.deliveries.reduce((acc, d) => {
    const c = deliveryCounts(d);
    return { paid: acc.paid + c.paid, open: acc.open + c.open, todo: acc.todo + c.todo };
  }, { paid: 0, open: 0, todo: 0 });
  return {
    cap,
    capText: epicCapDetail(cap, brl),
    counts,
    tasks: counts.paid + counts.open + counts.todo,
    selecting,
    toggleSelecting: () => { if (selecting) clearSelected(); setSelecting(!selecting); },
  };
}
