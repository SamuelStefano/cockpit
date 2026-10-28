import type { BitState } from './bit-state';

const GLOW = '#fed7aa';
const LINE = '#fdba74';
const SAD = '#fca5a5';

function Eyes({ state }: { state: BitState }) {
  if (state === 'happy') {
    return <path d="M42 60q6-8 12 0M66 60q6-8 12 0" stroke={GLOW} strokeWidth={4} strokeLinecap="round" fill="none" />;
  }
  if (state === 'sleeping') {
    return <path d="M42 60q6 4 12 0M66 60q6 4 12 0" stroke={GLOW} strokeWidth={3.6} strokeLinecap="round" fill="none" opacity={0.6} />;
  }
  if (state === 'waiting') {
    return (
      <g className="bit-pupils">
        <rect x={43} y={50} width={10} height={14} rx={5} fill={GLOW} />
        <rect x={67} y={50} width={10} height={14} rx={5} fill={GLOW} />
        <circle cx={49} cy={53} r={2} fill="#fff" />
        <circle cx={73} cy={53} r={2} fill="#fff" />
      </g>
    );
  }
  if (state === 'sneaky') {
    return (
      <g className="bit-pupils">
        <path d="M41 56h13M66 56h13" stroke={GLOW} strokeWidth={2.6} strokeLinecap="round" />
        <rect x={44} y={57} width={9} height={7} rx={3.5} fill={GLOW} />
        <rect x={68} y={57} width={9} height={7} rx={3.5} fill={GLOW} />
      </g>
    );
  }
  if (state === 'surprised') {
    return (
      <g className="bit-pupils">
        <circle cx={48} cy={58} r={8} fill="none" stroke={GLOW} strokeWidth={2.6} />
        <circle cx={72} cy={58} r={8} fill="none" stroke={GLOW} strokeWidth={2.6} />
        <circle cx={48} cy={58} r={3} fill={GLOW} />
        <circle cx={72} cy={58} r={3} fill={GLOW} />
      </g>
    );
  }
  if (state === 'dizzy') {
    return (
      <g stroke={GLOW} strokeWidth={3} strokeLinecap="round">
        <path d="M43 53l10 10M53 53l-10 10M67 53l10 10M77 53l-10 10" />
      </g>
    );
  }
  if (state === 'error') {
    return (
      <g>
        <path d="M41 54l12-4M79 54l-12-4" stroke={SAD} strokeWidth={3.4} strokeLinecap="round" />
        <circle cx={48} cy={61} r={3.6} fill={SAD} />
        <circle cx={72} cy={61} r={3.6} fill={SAD} />
      </g>
    );
  }
  return (
    <g className="bit-pupils">
      <rect x={43} y={52} width={10} height={14} rx={5} fill={GLOW} />
      <rect x={67} y={52} width={10} height={14} rx={5} fill={GLOW} />
      <circle cx={50} cy={56} r={2} fill="#fff" />
      <circle cx={74} cy={56} r={2} fill="#fff" />
    </g>
  );
}

function Mouth({ state, clipId }: { state: BitState; clipId: string }) {
  switch (state) {
    case 'thinking':
      return (
        <g className="bit-dots" fill={GLOW}>
          <circle cx={52} cy={77} r={2.4} />
          <circle cx={60} cy={77} r={2.4} />
          <circle cx={68} cy={77} r={2.4} />
        </g>
      );
    case 'working':
      return (
        <g clipPath={`url(#${clipId})`}>
          <g className="bit-lines" stroke={LINE} strokeWidth={2.4} strokeLinecap="round" opacity={0.85}>
            <path d="M42 74h22M42 80h30M42 86h16M42 92h26M42 98h20" />
          </g>
        </g>
      );
    case 'talking':
      return <ellipse className="bit-mouth" cx={60} cy={78} rx={6} ry={4} fill={GLOW} />;
    case 'waiting':
      return <circle cx={60} cy={79} r={3} fill="none" stroke={GLOW} strokeWidth={2.6} />;
    case 'sleeping':
      return null;
    case 'error':
      return <path d="M51 81q4.5-4 9 0t9 0" stroke={SAD} strokeWidth={3} strokeLinecap="round" fill="none" />;
    case 'surprised':
      return <ellipse cx={60} cy={80} rx={4} ry={5} fill={GLOW} />;
    case 'sneaky':
      return <path d="M48 74q12 9 24-2" stroke={GLOW} strokeWidth={3.2} strokeLinecap="round" fill="none" />;
    case 'dizzy':
      return <path d="M51 80q4.5-4 9 0t9 0" stroke={GLOW} strokeWidth={3} strokeLinecap="round" fill="none" />;
    case 'happy':
    case 'wave':
      return <path d="M50 73q10 10 20 0" stroke={GLOW} strokeWidth={3.4} strokeLinecap="round" fill="none" />;
    default:
      return <rect className="bit-cursor" x={55} y={75} width={10} height={3.4} rx={1.4} fill={GLOW} />;
  }
}

export function BitFace({ state, clipId }: { state: BitState; clipId: string }) {
  return (
    <>
      <g className="bit-gaze">
        <g className="bit-eyes">
          <Eyes state={state} />
        </g>
      </g>
      <Mouth state={state} clipId={clipId} />
    </>
  );
}
