import { useId } from 'react';
import { BitFace } from './BitFace';
import { BitFx } from './BitFx';
import { BIT_STATE_LABEL, type BitState } from './bit-state';
import './bit.css';

interface BitProps {
  state?: BitState;
  size?: number;
  title?: string;
  className?: string;
}

const BODY = '#f97316';
const BODY_TOP = '#fb923c';
const LIMB = '#c2410c';
const TIP = '#fdba74';
const RAISED_ARM = 'M96 68q15-3 17-21';
const LOW_ARM = 'M96 70q12 4 12 16';

// The Deck's mascot: a little terminal with a screen for a face, drawn in code
// so every state is just CSS on named parts (see bit.css).
export function Bit({ state = 'idle', size = 64, title, className = '' }: BitProps) {
  const uid = useId().replace(/:/g, '');
  const clipId = `bit-scr-${uid}`;
  const gradId = `bit-body-${uid}`;
  const glowId = `bit-glow-${uid}`;
  const screen = state === 'error' ? '#1f0a0a' : state === 'sleeping' ? '#0d0806' : '#140b05';
  return (
    <svg
      role="img" aria-label={title ?? BIT_STATE_LABEL[state]} viewBox="0 0 120 120" width={size} height={size}
      className={`bit bit-${state} shrink-0 overflow-visible ${className}`}
    >
      <defs>
        <clipPath id={clipId}><rect x={32} y={40} width={56} height={50} rx={13} /></clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BODY_TOP} />
          <stop offset="1" stopColor={BODY} />
        </linearGradient>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor={BODY} stopOpacity={0.6} />
          <stop offset="1" stopColor={BODY} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse className="bit-shadow" cx={60} cy={113} rx={30} ry={4} fill="#000" opacity={0.45} />
      <g className="bit-all">
        <BitFx state={state} />
        <g className="bit-body">
          <g className="bit-ant">
            <path d="M60 30V17" stroke={LIMB} strokeWidth={3.4} strokeLinecap="round" />
            <circle cx={60} cy={12} r={10} fill={`url(#${glowId})`} />
            <circle className="bit-tip" cx={60} cy={12} r={4.6} fill={state === 'sleeping' ? '#7c2d12' : TIP} />
          </g>
          <path className="bit-armL" d="M24 70q-12 4-12 16" stroke={LIMB} strokeWidth={7} strokeLinecap="round" fill="none" />
          <path className="bit-armR" d={state === 'wave' ? RAISED_ARM : LOW_ARM} stroke={LIMB} strokeWidth={7} strokeLinecap="round" fill="none" />
          <path d="M44 101v8M76 101v8" stroke={LIMB} strokeWidth={7} strokeLinecap="round" />
          <rect x={20} y={28} width={80} height={76} rx={22} fill={`url(#${gradId})`} />
          <rect x={20} y={28} width={80} height={76} rx={22} fill="none" stroke={LIMB} strokeWidth={2.4} opacity={0.55} />
          <path d="M31 36q29-8 58 0" stroke="#fff" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" fill="none" />
          <rect x={32} y={40} width={56} height={50} rx={13} fill={screen} />
          <rect x={32} y={40} width={56} height={50} rx={13} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={2} />
          <text x={37} y={50} fill={BODY} opacity={0.5} fontSize={7.5} fontWeight={700} fontFamily="ui-monospace, monospace">&gt;_</text>
          <BitFace state={state} clipId={clipId} />
          <circle cx={30} cy={96} r={2.4} fill="#fff" opacity={0.35} />
        </g>
      </g>
    </svg>
  );
}
