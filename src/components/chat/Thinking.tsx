import { useState, useEffect } from 'react';
import { ClaudeAvatar } from '../ClaudeAvatar';

function fmtElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export function Thinking() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fade-up flex gap-2.5">
      <div className="mt-0.5">
        <ClaudeAvatar size={28} />
      </div>
      <div className="flex items-center gap-2 pt-1.5">
        <div className="flex items-center gap-1">
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '0ms' }} />
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '160ms' }} />
          <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '320ms' }} />
        </div>
        <span className="text-[12px] text-neutral-500">pensando…</span>
        {secs >= 3 && <span className="text-[11px] tabular-nums text-neutral-600">{fmtElapsed(secs)}</span>}
      </div>
    </div>
  );
}
