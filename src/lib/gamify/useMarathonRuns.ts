import { useCallback, useEffect, useState } from 'react';
import { stepRuns, type MarathonRun } from './marathon-report';

const TICK_MS = 60_000;

// Marathon sessions' run history plus a minute clock, so the "idle for 10 min" test re-evaluates.
export function useMarathonRuns(marathon: Set<string>, running: Set<string>) {
  const [runs, setRuns] = useState<Record<string, MarathonRun>>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setRuns((prev) => stepRuns(prev, marathon, running, Date.now())); }, [marathon, running]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);
  const dismiss = useCallback((id: string) => setRuns((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], dismissed: true } } : prev)), []);
  return { runs, now, dismiss };
}
