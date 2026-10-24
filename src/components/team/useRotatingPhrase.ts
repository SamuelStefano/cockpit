import { useEffect, useState } from 'react';
import { PHRASE_MS, phraseAt } from './status-phrases';

// Elapsed is measured from the turn's own start, so a remount (route change,
// F5 replay) resumes the rotation where it was instead of restarting it.
export function useRotatingPhrase(active: boolean, startedAt?: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), PHRASE_MS);
    return () => clearInterval(t);
  }, [active]);
  return phraseAt(now - (startedAt ?? now));
}
