import { useState, useEffect } from 'react';

export function fmtElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

// Cronômetro de segundos desde `startedAt` (ts do início do turno). Sem ele cai no
// relógio local do componente — o que sobrevive a remontagem no reconnect é o ts.
export function useElapsed(startedAt?: number): number {
  const [secs, setSecs] = useState(() => (startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0));
  useEffect(() => {
    const base = startedAt ?? Date.now();
    setSecs(Math.max(0, Math.floor((Date.now() - base) / 1000)));
    const id = setInterval(() => setSecs(Math.max(0, Math.floor((Date.now() - base) / 1000))), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return secs;
}
