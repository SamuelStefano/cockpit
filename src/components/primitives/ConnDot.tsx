export type ConnState = 'connected' | 'reconnecting' | 'down';

const CONN_META: Record<ConnState, { color: string; label: string }> = {
  connected:    { color: 'var(--ok)',   label: 'conectado' },
  reconnecting: { color: 'var(--warn)', label: 'reconectando…' },
  down:         { color: 'var(--err)',  label: 'caiu' },
};

interface ConnDotProps {
  label: string;
  state: ConnState;
  compact?: boolean;
}

export function ConnDot({ label, state, compact }: ConnDotProps) {
  const meta = CONN_META[state];
  const pulse = state === 'reconnecting';
  return (
    <div className="group relative flex items-center gap-1.5">
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{
          background: meta.color,
          boxShadow: `0 0 6px ${meta.color}`,
          ['--ring' as string]: meta.color + '88',
          animation: pulse ? 'pulseRing 1.1s ease-out infinite' : 'none',
        }}
      />
      {!compact && <span className="text-[11px] font-medium text-neutral-400">{label}</span>}
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] text-neutral-200 shadow-xl group-hover:block">
        {label} · {meta.label}
      </span>
    </div>
  );
}
