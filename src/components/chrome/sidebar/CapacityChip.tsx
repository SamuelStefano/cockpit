import type { CapacityInfo } from '../../../../shared/protocol';
import { boxLabel } from '../../../cockpit/boxes-store';
import { useBoxes } from '../../../cockpit/useBoxes';
import { capacityLabel, capacityTip } from '../../../lib/capacity';
import { Tooltip } from '../../primitives';

export function CapacityChip({ capacity }: { capacity: CapacityInfo }) {
  const { boxes, active } = useBoxes();
  const box = boxes.find((b) => b.id === active);
  const tip = capacityTip(box ? boxLabel(box) : 'Esta máquina', capacity);
  const full = capacity.live >= capacity.cap;
  return (
    <Tooltip label={tip} side="bottom">
      <span
        role="status" aria-label={tip} tabIndex={0}
        className={`select-none rounded-md px-1 text-[12px] font-medium tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${full ? 'text-amber-400' : 'text-neutral-500'}`}
      >
        {capacityLabel(capacity)}
      </span>
    </Tooltip>
  );
}
