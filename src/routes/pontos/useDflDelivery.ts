import type { DflDeliveryNode } from '../../../shared/protocol';
import { usePontosControls } from './pontosControls';
import { deliveryCounts } from './treeFilter';
import { useToggle } from './useToggle';

// View state of one DFL delivery: folded or open, invoice pick, "off" switch, and
// the paid tasks tucked behind one summary line when there is live work beside
// them (22 paid rows would bury the one still open).
export function useDflDelivery(delivery: DflDeliveryNode, defaultOpen: boolean) {
  const { excluded, toggleExcluded, selecting, selected, toggleSelected } = usePontosControls();
  const fold = useToggle(defaultOpen);
  const paidFold = useToggle(false);
  const live = delivery.tasks.filter((t) => t.status !== 'paid');
  const paid = delivery.tasks.filter((t) => t.status === 'paid');
  return {
    counts: deliveryCounts(delivery),
    open: fold.on, toggleOpen: fold.toggle,
    off: excluded.has(delivery.id), toggleOff: () => toggleExcluded(delivery.id),
    selecting, picked: selected.has(delivery.id), togglePick: () => toggleSelected(delivery.id),
    live, paid,
    paidPoints: Math.round(paid.reduce((s, t) => s + t.points, 0) * 10) / 10,
    tuckPaid: live.length > 0 && paid.length > 0,
    showPaid: paidFold.on || live.length === 0, togglePaid: paidFold.toggle,
  };
}
