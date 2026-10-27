import { useCallback, useRef, useState } from 'react';
import { isNarrow } from './PickerSheet';

export function useComposerPlus() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  // Layout follows width, not touch: the popover would be clipped on a phone.
  const [sheet] = useState(isNarrow);
  const close = useCallback(() => setOpen(false), []);
  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => wrapRef.current?.querySelector('button')?.focus());
  }, []);
  // Closes BEFORE the action: `input.click()` steals focus to the native picker and
  // the menu would stay open behind it.
  const run = useCallback((fn: () => void) => { setOpen(false); fn(); }, []);
  return { open, toggle: () => setOpen((o) => !o), close, closeAndRefocus, run, wrapRef, sheet };
}
