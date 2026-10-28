import type { ReactNode } from 'react';
import { Badge, Icon, Tooltip, type IconName } from '../../primitives';

interface SidebarItemProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  expanded: boolean;
  active?: boolean;
  // Overrides the accessible name when the visible text is not enough (scripts target it).
  ariaLabel?: string;
  tip?: ReactNode;
  count?: number;
  trailing?: ReactNode;
  expandedControl?: boolean;
  haspopup?: boolean;
}

// One row. The 40px icon cell never moves between rail and expanded, so
// collapsing only reveals or hides the text beside it.
export function SidebarItem({ icon, label, onClick, expanded, active = false, ariaLabel, tip, count, trailing, expandedControl, haspopup }: SidebarItemProps) {
  return (
    <Tooltip label={tip ?? label} side="right" disabled={expanded} className={expanded ? 'flex w-full' : 'inline-flex'}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        aria-current={active ? 'page' : undefined}
        aria-expanded={expandedControl}
        aria-haspopup={haspopup ? 'dialog' : undefined}
        className={`flex h-9.5 items-center rounded-lg text-[14px] transition pointer-coarse:h-11 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40
          ${expanded ? 'w-full pr-2' : 'w-10'}
          ${active ? 'bg-neutral-800/90 text-neutral-50' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-100'}`}
      >
        <span className="relative flex h-9.5 w-10 shrink-0 items-center justify-center">
          <Icon name={icon} size={16} />
          {!expanded && !!count && (
            <span role="img" aria-label={`${count} esperando você`} className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-neutral-950" />
          )}
        </span>
        {expanded && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
        {expanded && !!count && <Badge tone="orange" title={`${count} esperando você`}>{count}</Badge>}
        {expanded && trailing}
      </button>
    </Tooltip>
  );
}
