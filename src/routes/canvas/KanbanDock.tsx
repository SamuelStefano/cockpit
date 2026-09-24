import { CARD_STATUSES, type CanvasCard } from '../../../shared/canvas';
import { Badge, Icon } from '../../components/primitives';
import { STATUS_LABEL } from './canvas-labels';
import type { SessionKanbanItem } from './kanban-items';

interface Props {
  cards: CanvasCard[];
  // Every session in scope also becomes a kanban item (kanban-items.ts
  // deriveSessionItems) — the folded strip must count both, or it reads
  // "0 everywhere" whenever there are no explicit task cards, which is the
  // common case (#598).
  sessionItems: SessionKanbanItem[];
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// The board used to take the bottom 40% of the screen at all times. Folded it
// is one 32px line with the counts; it only claims space when asked to.
export function KanbanDock({ cards, sessionItems, open, onToggle, children }: Props) {
  return (
    <div className={`flex shrink-0 flex-col border-t border-neutral-800 bg-neutral-950 ${open ? 'h-[38vh] min-h-56' : ''}`}>
      <button type="button" onClick={onToggle} className="flex h-8 shrink-0 items-center gap-2 px-3 text-left hover:bg-neutral-900">
        <Icon name={open ? 'chevronDown' : 'chevronUp'} size={13} className="text-neutral-500" />
        <span className="text-[11.5px] font-semibold text-neutral-300">kanban</span>
        {CARD_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1 text-[11px] text-neutral-500">
            {STATUS_LABEL[s]} <Badge>{cards.filter((c) => c.status === s).length + sessionItems.filter((i) => i.status === s).length}</Badge>
          </span>
        ))}
      </button>
      {open && <div className="flex min-h-0 flex-1 flex-col">{children}</div>}
    </div>
  );
}
