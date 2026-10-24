import type { TeamMascot } from '../../../shared/protocol';
import { MASCOT_SHAPES } from './mascot-shapes';
import { MASCOT_STATE_LABEL, type MascotState } from './mascot-state';
import { MascotFace } from './MascotFace';

interface MascotProps {
  mascot: TeamMascot;
  state?: MascotState;
  size?: number;
  name?: string;
  className?: string;
}

export function Mascot({ mascot, state = 'idle', size = 40, name, className = '' }: MascotProps) {
  const def = MASCOT_SHAPES[mascot.shape] ?? MASCOT_SHAPES.blob;
  const label = name ? `${name}: ${MASCOT_STATE_LABEL[state]}` : MASCOT_STATE_LABEL[state];
  return (
    <svg
      role="img" aria-label={label} viewBox="0 0 64 64" width={size} height={size}
      className={`mascot mascot-${state} shrink-0 overflow-visible ${className}`}
    >
      <g className="mascot-body" style={{ transformOrigin: '32px 58px' }}>
        <path d={def.body} fill={mascot.color} />
        <MascotFace state={state} cx={def.eyes[0]} cy={def.eyes[1]} gap={def.gap} />
      </g>
    </svg>
  );
}
