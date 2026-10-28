import type { ReactNode } from 'react';
import { Badge, Icon, Tooltip, type IconName } from '../../primitives';

interface SidebarItemProps {
  icon: IconName;
  // Tailwind classes for the colored tile behind the icon (bg + text). Bare icon when omitted.
  tile?: string;
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
export function SidebarItem({ icon, tile, label, onClick, expanded, active = false, ariaLabel, tip, count, trailing, expandedControl, haspopup }: SidebarItemProps) {
  return (
    <Tooltip label={tip ?? label} side="right" disabled={expanded} className={expanded ? 'flex w-full' : 'inline-flex'}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        aria-current={active ? 'page' : undefined}
        aria-expanded={expandedControl}
        aria-haspopup={haspopup ? 'dialog' : undefined}
        className={`flex h-11 items-center rounded-xl text-[14px] transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40
          ${expanded ? 'w-full pr-2' : 'w-10'}
          ${active ? 'bg-orange-500/12 font-semibold text-orange-100 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.3)]' : 'text-neutral-300 hover:bg-neutral-800/50 hover:text-neutral-100'}`}
      >
        <span className="relative flex h-11 w-10 shrink-0 items-center justify-center">
          {tile ? <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tile}`}><Icon name={icon} size={15} /></span> : <Icon name={icon} size={17} />}
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
