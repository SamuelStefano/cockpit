import { Badge } from '../../components/primitives';
import { alertLabel, type AlertKind } from './canvas-alerts';

// The color is set as a STATIC inline box-shadow (never via `.pulse-ring`,
// whose animated `--ring` is orange and would make every alert pulse the same
// color as the ordinary "active window" ring). `.alert-ring` (src/index.css)
// only animates opacity on top of it, and turns itself off under
// prefers-reduced-motion — leaving the static colored ring in place, per spec.
const RING_COLOR: Record<'waiting' | 'context', string> = {
  waiting: 'rgba(250, 204, 21, 0.85)', // yellow-400
  context: 'rgba(239, 68, 68, 0.85)', // red-500
};

export function AlertRing({ kind }: { kind: AlertKind }) {
  if (!kind) return null;
  // Inset, not outset: an outset ring/box-shadow gets cut off by a parent's
  // `overflow-hidden` (TerminalWindow's rounded corners clip their content) —
  // inset draws inside the border box, so it's never clipped.
  return <span aria-hidden className="alert-ring pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `inset 0 0 0 2px ${RING_COLOR[kind]}` }} />;
}

export function AlertBadge({ kind, pct }: { kind: AlertKind; pct: number | null }) {
  if (!kind) return null;
  return <Badge tone={kind === 'waiting' ? 'yellow' : 'red'}>{alertLabel(kind, pct)}</Badge>;
}
