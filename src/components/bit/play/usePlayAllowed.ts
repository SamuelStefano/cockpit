import { useEffect, useState } from 'react';
import { usePersisted } from '../../../lib/persist';
import { BIT_PLAYFUL_KEY, BIT_PLAYFUL_DEFAULT } from '../../../lib/prefs';

const REDUCED = '(prefers-reduced-motion: reduce)';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

// Bit may play only when the user wants it, the OS doesn't ask for less motion,
// and someone can actually see the tab.
export function usePlayAllowed(): boolean {
  const [playful] = usePersisted<boolean>(BIT_PLAYFUL_KEY, BIT_PLAYFUL_DEFAULT);
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  return playful && !reduced && visible;
}
