import { tokens } from './tokens';

export interface SegmentedItem<T extends string> { id: T; label: string }

interface SegmentedProps<T extends string> {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}

// Compact one-of-N filter (todos · aberto · a fazer · pago). Lighter than Tabs:
// it narrows a list in place instead of switching the page's content.
export function Segmented<T extends string>({ items, value, onChange, label, className = '' }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex items-center gap-px rounded-md border border-neutral-800 bg-neutral-950 p-px ${className}`}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(it.id)}
            className={`rounded-[5px] px-2 py-0.5 font-mono text-[10.5px] lowercase transition ${tokens.focusRing} ${
              on ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
