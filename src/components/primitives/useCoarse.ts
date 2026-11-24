import { useEffect, useState } from 'react';

export const COARSE_QUERY = '(pointer: coarse), (max-width: 719px)';

export function useCoarse(): boolean {
  const [coarse, setCoarse] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(COARSE_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(COARSE_QUERY);
    const on = () => setCoarse(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return coarse;
}
