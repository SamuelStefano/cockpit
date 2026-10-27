import { useCallback, useRef, useState } from 'react';

export function useComposerPlus() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => wrapRef.current?.querySelector('button')?.focus());
  }, []);
  const run = useCallback((fn: () => void) => { setOpen(false); fn(); }, []);
  return { open, toggle: () => setOpen((o) => !o), closeAndRefocus, run, wrapRef };
}
