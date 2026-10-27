import type { BotState } from './botState';

interface MascotFaceProps { state: BotState; cx: number; cy: number; gap: number }

const INK = '#0b0b0c';

export function MascotFace({ state, cx, cy, gap }: MascotFaceProps) {
  const l = cx - gap / 2;
  const r = cx + gap / 2;
  if (state === 'error') {
    const bar = (x0: number) => `M${x0 - 3.5} ${cy}h7`;
    return <path className="mascot-eyes" d={`${bar(l)}${bar(r)}`} stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />;
  }
  if (state === 'done') {
    const arc = (x0: number) => `M${x0 - 4} ${cy + 3}q4-8 8 0`;
    return <path className="mascot-eyes" d={`${arc(l)}${arc(r)}`} stroke={INK} strokeWidth={3.4} strokeLinecap="round" fill="none" />;
  }
  if (state === 'working') {
    return (
      <g className="mascot-dots" fill={INK}>
        <circle cx={cx - 8} cy={cy} r={3.2} />
        <circle cx={cx} cy={cy} r={3.2} />
        <circle cx={cx + 8} cy={cy} r={3.2} />
      </g>
    );
  }
  const big = state === 'waiting';
  const rx = big ? 3.8 : 3.2;
  const ry = big ? 5.6 : 4.8;
  return (
    <g className="mascot-eyes" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <ellipse cx={l} cy={cy} rx={rx} ry={ry} fill={INK} />
      <ellipse cx={r} cy={cy} rx={rx} ry={ry} fill={INK} />
    </g>
  );
}
