import type { MascotShape } from '../../../shared/protocol';
import { Mascot } from '../../components/team/Mascot';
import { MASCOT_COLORS } from '../../components/team/mascot-shapes';
import { tokens } from '../../components/primitives';

const SHAPES: { id: MascotShape; label: string }[] = [
  { id: 'drop', label: 'gota' }, { id: 'blob', label: 'bolha' }, { id: 'tri', label: 'triângulo' }, { id: 'bean', label: 'batata' },
];

interface MascotPickerProps {
  shape: MascotShape;
  color: string;
  onShape: (s: MascotShape) => void;
  onColor: (c: string) => void;
}

export function MascotPicker({ shape, color, onShape, onColor }: MascotPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Forma do mascote" className="flex gap-2">
        {SHAPES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={shape === s.id} aria-label={s.label} title={s.label}
            onClick={() => onShape(s.id)}
            className={`rounded-xl p-1.5 pointer-coarse:p-2.5 transition ${shape === s.id ? `bg-neutral-800 ${tokens.insetRing.accent}` : 'hover:bg-neutral-900'} ${tokens.focusRing}`}>
            <Mascot mascot={{ shape: s.id, color }} size={36} />
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Cor do mascote" className="flex flex-wrap gap-1.5 pointer-coarse:gap-3">
        {MASCOT_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`cor ${c}`}
            onClick={() => onColor(c)} style={{ background: c }}
            className={`h-6 w-6 pointer-coarse:size-9 rounded-full transition ${color === c ? 'ring-2 ring-neutral-100 ring-offset-2 ring-offset-neutral-950' : ''} ${tokens.focusRing}`} />
        ))}
      </div>
    </div>
  );
}
