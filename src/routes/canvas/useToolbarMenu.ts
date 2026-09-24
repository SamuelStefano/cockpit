import { useEffect, useRef, useState } from 'react';

// Same close-on-outside-pointerdown behaviour RouteMenu already uses for its
// mobile nav dropdown — extracted so CanvasToolbar stays JSX-only (CLAUDE.md:
// logic lives in a hook, the component only renders).
export function useToolbarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);
  return { open, ref, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}
