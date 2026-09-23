import type { ReactNode } from 'react';
import { tokens } from './tokens';
import { useInlineEdit } from './useInlineEdit';

interface InlineEditProps {
  value: string;
  onSave: (next: string) => void;
  // What is shown while not editing (defaults to the value itself).
  display?: ReactNode;
  numeric?: boolean;
  validate?: (next: string) => boolean;
  label: string;
  // Dotted underline at rest: on for knobs (a value you are expected to tune),
  // off for titles (shown only on hover, or a list of titles turns into noise).
  hint?: boolean;
  className?: string;
  inputClassName?: string;
}

// Text that turns into an input on click: titles, point values, R$ amounts. One
// primitive so every editable number/title on a page behaves the same way.
export function InlineEdit({ value, onSave, display, numeric = false, validate, label, hint = true, className = '', inputClassName = '' }: InlineEditProps) {
  const e = useInlineEdit({ value, onSave, validate });
  if (e.editing) {
    return (
      <input
        autoFocus value={e.draft} aria-label={label}
        onChange={(ev) => e.setDraft(ev.target.value)} onBlur={e.commit} onKeyDown={e.onKeyDown}
        inputMode={numeric ? 'decimal' : undefined}
        className={`min-w-0 rounded-md border border-orange-500/40 bg-neutral-950 px-1.5 py-0.5 text-neutral-100 outline-hidden ${numeric ? 'tabular-nums' : ''} ${inputClassName}`}
      />
    );
  }
  return (
    <button
      type="button" onClick={e.start} title={`Editar ${label}`}
      className={`min-w-0 cursor-text rounded-md text-left underline decoration-dotted underline-offset-4 transition hover:text-orange-300 hover:decoration-orange-400/60 ${hint ? 'decoration-neutral-700' : 'decoration-transparent'} ${tokens.focusRing} ${numeric ? 'tabular-nums' : ''} ${className}`}
    >
      {display ?? value}
    </button>
  );
}
