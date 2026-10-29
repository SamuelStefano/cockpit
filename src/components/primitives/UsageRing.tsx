export type RingTone = 'ok' | 'mid' | 'high' | 'idle';

interface UsageRingProps {
  // 0–100; null = unknown (empty grey ring).
  value: number | null;
  size?: number;
  // Overrides the threshold tone (e.g. a stale reading goes idle/grey).
  tone?: RingTone;
  // Spoken description; the visible number lives in a Tooltip, never in the ring.
  label?: string;
  // 0–100 marker on the track (the ideal pace), drawn as a short radial tick.
  tick?: number | null;
  className?: string;
}

const STROKE = 3;
const STROKES: Record<RingTone, string> = {
  ok: 'stroke-emerald-500',
  mid: 'stroke-amber-500',
  high: 'stroke-red-500',
  idle: 'stroke-neutral-600',
};

export function ringToneOf(value: number | null): RingTone {
  if (value === null) return 'idle';
  if (value >= 90) return 'high';
  if (value >= 70) return 'mid';
  return 'ok';
}

export function UsageRing({ value, size = 24, tone, label, tick = null, className = '' }: UsageRingProps) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const r = (size - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const t = tone ?? ringToneOf(value);
  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-label={label ?? 'Uso'}
      className={`-rotate-90 ${className}`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={STROKE} className="stroke-neutral-800" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={STROKE} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        className={`transition-[stroke-dashoffset] duration-500 ${STROKES[t]}`}
      />
      {tick !== null && (
        <line
          data-testid="ring-tick" x1={r + STROKE} y1={0} x2={r - STROKE} y2={0} strokeWidth={1.5} strokeLinecap="round"
          className="stroke-neutral-200" transform={`translate(${size / 2} ${size / 2}) rotate(${Math.max(0, Math.min(100, tick)) * 3.6})`}
        />
      )}
    </svg>
  );
}
