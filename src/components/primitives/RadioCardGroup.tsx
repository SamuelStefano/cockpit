import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { tokens } from './tokens';

export interface RadioCardItem<T extends string> {
  id: T;
  title: string;
  description: string;
  icon: IconName;
  badge?: ReactNode;
}

interface RadioCardGroupProps<T extends string> {
  items: RadioCardItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}

// Decision between a few options that deserve a sentence each (install mode).
// Same radiogroup contract as Segmented: one Tab stop, arrows move and select.
export function RadioCardGroup<T extends string>({ items, value, onChange, label, className = '' }: RadioCardGroupProps<T>) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir || !items.length) return;
    e.preventDefault();
    const i = Math.max(0, items.findIndex((it) => it.id === value));
    const n = (i + dir + items.length) % items.length;
    onChange(items[n].id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[n]?.focus();
  };
  const hasValue = items.some((x) => x.id === value);
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${className}`}>
      {items.map((it, idx) => {
        const on = it.id === value;
        return (
          <button
            key={it.id} type="button" role="radio" aria-checked={on} tabIndex={on || (!hasValue && idx === 0) ? 0 : -1} onClick={() => onChange(it.id)}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition ${tokens.focusRing} ${
              on ? 'border-orange-500/60 bg-orange-500/6' : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'}`}
          >
            <span className="flex w-full items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-orange-500/15 text-orange-400' : 'bg-neutral-800 text-neutral-400'}`}>
                <Icon name={it.icon} size={14} />
              </span>
              <span className={`text-[13px] font-medium ${on ? 'text-neutral-100' : 'text-neutral-300'}`}>{it.title}</span>
              {it.badge && <span className="ml-auto">{it.badge}</span>}
            </span>
            <span className="text-[12px] leading-relaxed text-neutral-400">{it.description}</span>
          </button>
        );
      })}
    </div>
  );
}
