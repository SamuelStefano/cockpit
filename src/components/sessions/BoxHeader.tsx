import { Badge, Icon } from '../primitives';
import type { BoxInfo } from '../../../shared/boxes';
import { boxLabel } from '../../cockpit/boxes-store';
import { BoxDot } from './BoxDot';

export function BoxHeader({ box, open, onToggle, current = false, count }: { box: BoxInfo; open: boolean; onToggle: () => void; current?: boolean; count?: number }) {
  return (
    <button
      type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Recolher' : 'Expandir'} ${boxLabel(box)}`}
      className={`flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[12.5px] font-medium transition hover:bg-neutral-900 ${box.online ? 'text-neutral-200' : 'text-neutral-600'}`}
    >
      <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} className="shrink-0 text-neutral-500" />
      <BoxDot online={box.online} />
      <span className="min-w-0 flex-1 truncate">{boxLabel(box)}</span>
      {current && <Badge>atual</Badge>}
      {!box.online && <span className="shrink-0 text-[11.5px] text-neutral-600">offline</span>}
      {count !== undefined && <span className="shrink-0 tabular-nums text-neutral-600">{count}</span>}
    </button>
  );
}
