import { useEffect, useState } from 'react';

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

// Phone-only elapsed counter beside the living phrase; desktop has TurnStat.
export function LiveElapsed({ startedAt }: { startedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  return <span className="ml-1.5 text-[12px] tabular-nums text-neutral-600 lg:hidden">{formatElapsed(now - startedAt)}</span>;
}
