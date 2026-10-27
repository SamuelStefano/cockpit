import { useEffect, useState } from 'react';

const QUERY = '(pointer: coarse), (max-width: 719px)';

export function useCoarse(): boolean {
  const [coarse, setCoarse] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const on = () => setCoarse(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return coarse;
}
