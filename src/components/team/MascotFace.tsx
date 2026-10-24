import type { MascotState } from './mascot-state';

interface MascotFaceProps { state: MascotState; cx: number; cy: number; gap: number }

const INK = '#0b0b0c';

export function MascotFace({ state, cx, cy, gap }: MascotFaceProps) {
  const l = cx - gap / 2;
  const r = cx + gap / 2;
  if (state === 'blocked') {
    const x = (x0: number) => `M${x0 - 3} ${cy - 3}l6 6M${x0 + 3} ${cy - 3}l-6 6`;
    return <path d={`${x(l)}${x(r)}`} stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />;
  }
  if (state === 'done') {
    const arc = (x0: number) => `M${x0 - 4} ${cy + 1.5}q4-6 8 0`;
    return <path d={`${arc(l)}${arc(r)}`} stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" />;
  }
  if (state === 'thinking') {
    return (
      <g>
        <ellipse cx={l + 0.5} cy={cy - 3.5} rx={2.6} ry={3.4} fill={INK} />
        <ellipse cx={r + 0.5} cy={cy - 3.5} rx={2.6} ry={3.4} fill={INK} />
        <g className="mascot-dots" fill={INK}>
          <circle cx={cx - 5} cy={cy + 7} r={1.6} />
          <circle cx={cx} cy={cy + 7} r={1.6} />
          <circle cx={cx + 5} cy={cy + 7} r={1.6} />
        </g>
      </g>
    );
  }
  const dx = state === 'waiting' ? 3 : 0;
  const ry = state === 'working' ? 2.8 : 4.6;
  return (
    <g className="mascot-eyes" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <ellipse cx={l + dx} cy={cy} rx={2.8} ry={ry} fill={INK} />
      <ellipse cx={r + dx} cy={cy} rx={2.8} ry={ry} fill={INK} />
    </g>
  );
}
