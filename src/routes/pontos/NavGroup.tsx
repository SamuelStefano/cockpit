import type { ReactNode } from 'react';
import { Icon } from '../../components/primitives';
import type { NavRow as Row } from './nav-model';
import { NavRow } from './NavRow';
import { fmtPts } from './money';
import { useToggle } from './useToggle';

interface Props {
  title: string;
  rows: Row[];
  activeKey: string;
  onSelect: (key: string) => void;
  defaultOpen?: boolean;
  marks?: Map<string, number>;
  action?: ReactNode;
  empty?: string;
}

// A collapsible block of the navigator. Invoiced epics start closed: they are
// history, and twenty of them would push what needs a decision off screen.
export function NavGroup({ title, rows, activeKey, onSelect, defaultOpen = true, marks, action, empty }: Props) {
  const { on: open, toggle } = useToggle(defaultOpen);
  const total = Math.round(rows.reduce((s, r) => s + r.points, 0) * 10) / 10;
  const holdsActive = rows.some((r) => r.key === activeKey);
  const shown = open || holdsActive;
  return (
    <div className="py-1">
      <div className="flex h-7 items-center gap-1 pl-1 pr-1">
        <button type="button" onClick={toggle} aria-expanded={shown}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-mono text-[10.5px] lowercase tracking-wide text-neutral-500 hover:text-neutral-300">
          <Icon name={shown ? 'chevronDown' : 'chevronRight'} size={11} className="shrink-0" />
          <span className="truncate">{title}</span>
          <span className="text-neutral-600">{rows.length}</span>
          {rows.length > 0 && <span className="ml-auto pr-1 tabular-nums text-neutral-600">{fmtPts(total)} pt</span>}
        </button>
        {action}
      </div>
      {shown && (
        rows.length
          ? <div className="flex flex-col gap-px">
              {(open ? rows : rows.filter((r) => r.key === activeKey)).map((r) => (
                <NavRow key={r.key} row={r} active={r.key === activeKey} marked={marks?.get(r.id)} onSelect={onSelect} />
              ))}
            </div>
          : empty && <p className="px-2.5 py-1.5 text-[11.5px] text-neutral-600">{empty}</p>
      )}
    </div>
  );
}
