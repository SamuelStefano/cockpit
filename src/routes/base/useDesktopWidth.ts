import { useEffect, useState } from 'react';

export const MIN_WIDTH = 1100;

export function useDesktopWidth(): boolean {
  const [ok, setOk] = useState(() => window.innerWidth >= MIN_WIDTH);
  useEffect(() => {
    const on = () => setOk(window.innerWidth >= MIN_WIDTH);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return ok;
}
