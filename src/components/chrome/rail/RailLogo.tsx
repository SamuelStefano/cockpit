import { Tooltip, tokens } from '../../primitives';
import { Bit } from '../../bit/Bit';
import { useLogoBit } from '../../bit/useLogoBit';
import { BIT_STATE_LABEL, type BitState } from '../../bit/bit-state';

export function RailLogo({ bitState, onHome }: { bitState: BitState; onHome: () => void }) {
  const logo = useLogoBit(bitState);
  return (
    <Tooltip label={`Ir pro chat · ${BIT_STATE_LABEL[bitState]}`} side="right" className="flex">
      <button type="button" onClick={() => { logo.pet(); onHome(); }} aria-label="Ir pro chat" className={`bit-greet mb-2 flex h-11 w-11 items-center justify-center rounded-xl ${tokens.focusRing}`}>
        <span className={`relative inline-flex ${logo.startle ? 'bit-startle' : ''}`}>
          <Bit state={logo.state} size={34} />
          {logo.hearts > 0 && [0, 1, 2].map((i) => (
            <span key={`${logo.hearts}-${i}`} aria-hidden className="bit-heart" style={{ '--hx': `${(i - 1) * 9}px`, animationDelay: `${i * 0.18}s` } as React.CSSProperties}>❤️</span>
          ))}
        </span>
      </button>
    </Tooltip>
  );
}
