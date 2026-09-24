import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  right?: ReactNode;
  // Below sm: no icons, tighter padding — for a strip that must fit a phone
  // next to its `right` action instead of scrolling it off-screen.
  compact?: boolean;
}

export function Tabs<T extends string>({ items, active, onChange, className = '', right, compact = false }: TabsProps<T>) {
  return (
    <div className={`flex items-center gap-1 border-b border-neutral-800 ${className}`}>
      <div role="tablist" className="flex items-center gap-1">
        {items.map((it) => {
          const on = it.id === active;
          return (
            <button
              key={it.id} onClick={() => onChange(it.id)}
              type="button" role="tab" aria-selected={on}
              className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[12.5px] font-medium transition ${compact ? 'max-sm:px-2' : ''} ${
                on ? 'border-orange-500 text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
            >
              {it.icon && <Icon name={it.icon} size={13} className={compact ? 'max-sm:hidden' : undefined} />}
              {it.label}
              {it.count != null && (
                <span className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${on ? 'bg-orange-500/15 text-orange-300' : 'bg-neutral-800 text-neutral-500'}`}>{it.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {right != null && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  );
}
