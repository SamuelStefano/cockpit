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
}

export function Tabs<T extends string>({ items, active, onChange, className = '', right }: TabsProps<T>) {
  return (
    <div className={`flex items-center gap-1 border-b border-neutral-800 ${className}`}>
      <div className="flex items-center gap-1">
        {items.map((it) => {
          const on = it.id === active;
          return (
            <button
              key={it.id} onClick={() => onChange(it.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-medium transition ${
                on ? 'border-orange-500 text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
            >
              {it.icon && <Icon name={it.icon} size={13} />}
              {it.label}
              {it.count != null && (
                <span className={`rounded-full px-1.5 py-[1px] text-[10px] tabular-nums ${on ? 'bg-orange-500/15 text-orange-300' : 'bg-neutral-800 text-neutral-500'}`}>{it.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {right != null && <div className="ml-auto">{right}</div>}
    </div>
  );
}
