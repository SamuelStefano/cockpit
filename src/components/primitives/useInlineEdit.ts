import { useRef, useState } from 'react';

interface Args {
  value: string;
  onSave: (next: string) => void;
  validate?: (next: string) => boolean;
}

// Click-to-edit state: Enter/blur commits (only a valid, changed value), Escape
// or an invalid value falls back to the current one.
export function useInlineEdit({ value, onSave, validate }: Args) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const start = () => { setDraft(value); setEditing(true); };
  const cancel = () => { setDraft(value); setEditing(false); };
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value && next !== '' && (!validate || validate(next))) onSave(next);
    else setDraft(value);
  };
  // Safari confirms a candidate with a keyCode-229 Enter right after compositionend;
  // other IMEs report 229 on every key, so 229 alone must not block Enter.
  const compositionEndAt = useRef(-Infinity);
  const onCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => { compositionEndAt.current = e.timeStamp; };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter/Escape inside an IME or dead-key composition belong to the candidate.
    if (e.nativeEvent.isComposing) return;
    if (e.keyCode === 229 && e.timeStamp - compositionEndAt.current < 100) return;
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };
  return { editing, draft, setDraft, start, commit, onKeyDown, onCompositionEnd };
}
