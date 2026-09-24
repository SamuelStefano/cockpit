import { useEffect, useMemo, useState } from 'react';
import { CARD_STATUSES, type CanvasCard } from '../../../shared/canvas';
import { Badge, Icon } from '../../components/primitives';
import { STATUS_LABEL } from './canvas-labels';
import { triageSessionItems, type SessionKanbanItem } from './kanban-items';

interface Props {
  cards: CanvasCard[];
  // Every session in scope also becomes a kanban item (kanban-items.ts
  // deriveSessionItems) — the folded strip must count both, or it reads
  // "0 everywhere" whenever there are no explicit task cards, which is the
  // common case (#598).
  sessionItems: SessionKanbanItem[];
  // Manually-hidden ids (board-persisted, Kanban.tsx). Optional so a caller
  // predating this prop still compiles — the strip count is very slightly
  // over-broad (by whatever's manually hidden) until it's wired through.
  hiddenSessionIds?: Set<string>;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// The board used to take the bottom 40% of the screen at all times. Folded it
// is one 32px line with the counts; it only claims space when asked to.
//
// Runs the SAME triageSessionItems the open Done column uses (Kanban.tsx),
// instead of counting every untriaged item — the strip used to read "Done
// 251" while the open column read "Done 43", same board, two numbers (canvas
// review item 2). "Done N · +M antigos" mirrors the open column's own header.
export function KanbanDock({ cards, sessionItems, hiddenSessionIds, open, onToggle, children }: Props) {
  // 12d-style ticker (own copy, same reasoning as Kanban.tsx's): the folded
  // strip renders independently of the open column, so it needs its own
  // re-triage as items cross the 24h line, not just when props change.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const shown = useMemo(
    () => (hiddenSessionIds ? sessionItems.filter((s) => !hiddenSessionIds.has(s.sessionId)) : sessionItems),
    [sessionItems, hiddenSessionIds],
  );
  const triage = useMemo(() => triageSessionItems(shown, now), [shown, now]);
  return (
    <div className={`flex shrink-0 flex-col border-t border-neutral-800 bg-neutral-950 ${open ? 'h-[38vh] min-h-56' : ''}`}>
      {/* One 32px line at any width: on a 390px phone "In progress" and
          "+8 antigos" wrapped to two lines and spilled out of the strip. */}
      <button type="button" onClick={onToggle} className="flex h-8 min-w-0 shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap px-3 text-left hover:bg-neutral-900">
        <Icon name={open ? 'chevronDown' : 'chevronUp'} size={13} className="text-neutral-500" />
        {/* The chevron already says "this expands"; below sm the word costs
            the width the last column's count needs; sr-only keeps it in the name. */}
        <span className="sr-only text-[11.5px] font-semibold text-neutral-300 sm:not-sr-only">kanban</span>
        {CARD_STATUSES.map((s) => {
          const n = cards.filter((c) => c.status === s).length + triage.visible.filter((i) => i.status === s).length;
          const stale = s === 'review' ? triage.staleDone.length : 0;
          return (
            <span key={s} className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-500">
              {STATUS_LABEL[s]} <Badge>{n}</Badge>
              {stale > 0 && <span className="hidden text-neutral-600 sm:inline">+{stale} antigos</span>}
            </span>
          );
        })}
      </button>
      {open && <div className="flex min-h-0 flex-1 flex-col">{children}</div>}
    </div>
  );
}
