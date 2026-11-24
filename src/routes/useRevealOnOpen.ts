import { useEffect, useRef } from 'react';

// The terminal opens below the steps, often under the fold: bring it on screen.
export function useRevealOnOpen<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [open]);
  return ref;
}
