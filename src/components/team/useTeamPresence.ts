import { useEffect, useState } from 'react';
import { LEAVE_FADE_MS, LEAVE_LINGER_MS } from './team-working';

export type Presence = 'hidden' | 'shown' | 'leaving';

// Mounted while the team works; once the last one finishes it holds 1.5 s, fades
// for 200 ms and unmounts.
export function useTeamPresence(active: boolean): Presence {
  const [p, setP] = useState<Presence>(active ? 'shown' : 'hidden');
  useEffect(() => {
    if (active) { setP('shown'); return; }
    const t1 = setTimeout(() => setP((cur) => (cur === 'shown' ? 'leaving' : cur)), LEAVE_LINGER_MS);
    const t2 = setTimeout(() => setP('hidden'), LEAVE_LINGER_MS + LEAVE_FADE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);
  return active ? 'shown' : p;
}
