import { useEffect, useState } from 'react';
import { phraseAt } from '../cockpit/agents-view';

export function useTestPhrase(active: boolean): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) { setI(0); return; }
    const t = setInterval(() => setI((n) => n + 1), 1200);
    return () => clearInterval(t);
  }, [active]);
  return phraseAt(i);
}
