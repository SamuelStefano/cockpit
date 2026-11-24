import type { TeamMascot } from '../../../shared/protocol';
import { MASCOT_SHAPES } from './mascot-shapes';
import { BOT_STATE_LABEL, type BotState } from './botState';
import { MascotFace } from './MascotFace';

interface MascotProps {
  mascot: TeamMascot;
  state?: BotState;
  size?: number;
  name?: string;
  className?: string;
}

export function Mascot({ mascot, state = 'idle', size = 40, name, className = '' }: MascotProps) {
  const def = MASCOT_SHAPES[mascot.shape] ?? MASCOT_SHAPES.blob;
  const label = name ? `${name}: ${BOT_STATE_LABEL[state]}` : BOT_STATE_LABEL[state];
  return (
    <svg
      role="img" aria-label={label} viewBox="0 0 64 64" width={size} height={size}
      className={`mascot mascot-${state} shrink-0 overflow-visible ${className}`}
    >
      {state === 'waiting' && <circle className="mascot-ring" cx={32} cy={32} r={23.5} fill="none" stroke="#f97316" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      <g className="mascot-body" style={{ transformOrigin: '32px 58px' }}>
        <path d={def.body} fill={mascot.color} />
        <MascotFace state={state} cx={def.eyes[0]} cy={def.eyes[1]} gap={def.gap} />
      </g>
    </svg>
  );
}
