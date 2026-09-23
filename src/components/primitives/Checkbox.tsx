import { Icon } from './Icon';
import { tokens } from './tokens';

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;          // accessible name; the box itself has no visible text
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
}

// Compact 14px box for dense tables (select rows, pick deliveries to invoice).
// The touch area grows to 40px on coarse pointers without changing the layout.
export function Checkbox({ checked, onChange, label, indeterminate = false, disabled = false, className = '' }: CheckboxProps) {
  const on = checked || indeterminate;
  return (
    <button
      type="button" role="checkbox" aria-checked={indeterminate ? 'mixed' : checked} aria-label={label} title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition disabled:opacity-40 ${tokens.touchTarget} ${tokens.focusRing} ${
        on ? 'border-orange-500 bg-orange-500 text-neutral-950' : 'border-neutral-600 text-transparent hover:border-neutral-400'} ${className}`}
    >
      {indeterminate ? <span className="h-0.5 w-2 rounded-full bg-current" /> : <Icon name="check" size={10} stroke={3} />}
    </button>
  );
}
