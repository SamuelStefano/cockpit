import { useEffect, useRef, useState } from 'react';

// Card-local UI state: task list collapsed by default (seven epics expanded is a
// wall of text) and a two-tap delete that disarms itself after 3 s.
export function useDraftEpicCard(onDelete: () => void) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const clickDelete = () => {
    if (timer.current) clearTimeout(timer.current);
    if (armed) { setArmed(false); onDelete(); return; }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3000);
  };

  return { open, toggle: () => setOpen((v) => !v), armed, clickDelete };
}
