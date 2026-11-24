import { useRef, type CSSProperties } from 'react';
import { Bit } from '../Bit';
import type { BitState } from '../bit-state';
import { useFishing } from './useFishing';
import type { FishPhase } from './fishing';
import '../bit-play.css';
import './fishing.css';

const WAVE = 'M-24 100q6-3 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0';

function look(phase: FishPhase, dip: boolean): { face: BitState; pose: string; cls: string } {
  if (phase === 'enter') return { face: 'idle', pose: 'bit-walking', cls: 'fish-bit-walk-in' };
  if (phase === 'reel') return { face: 'happy', pose: 'bit-sit', cls: 'fish-bit-flip fish-bit-hop' };
  if (phase === 'wave') return { face: 'wave', pose: '', cls: 'fish-bit-flip' };
  if (phase === 'leave') return { face: 'idle', pose: 'bit-walking', cls: 'fish-bit-walk-out' };
  return { face: dip ? 'surprised' : 'idle', pose: 'bit-sit', cls: 'fish-bit-flip' };
}

// A pier in the free margin right of the message column. Decoration: aria-hidden and
// click-through, except the narrow hit area over Bit that makes it catch right away.
export function BitFishing({ running, forceRoom = false }: { running: boolean; forceRoom?: boolean }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const f = useFishing(layerRef, running, forceRoom);
  const on = f.phase !== 'off';
  const reeling = f.phase === 'reel' || f.phase === 'wave' || f.phase === 'leave';
  const l = look(f.phase, f.dip);
  return (
    <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {on && (
        <div className={`fish-scene ${f.phase === 'enter' ? 'fish-scene-in' : f.phase === 'leave' ? 'fish-scene-out' : ''}`}>
          <svg className="fish-svg" viewBox="0 0 116 116" width={116} height={116}>
            <defs><clipPath id="fish-water"><rect x={0} y={93} width={68} height={14} /></clipPath></defs>
            <g clipPath="url(#fish-water)">
              <path className="fish-wave-b" d={WAVE} transform="translate(0 3)" stroke="#0ea5e9" strokeOpacity={0.3} strokeWidth={1.2} fill="none" />
              <path className="fish-wave-a" d={WAVE} stroke="#38bdf8" strokeOpacity={0.65} strokeWidth={1.4} fill="none" />
            </g>
            <path d="M58 87h58" stroke="#92400e" strokeWidth={6} strokeLinecap="round" />
            <path d="M58 85.5h58" stroke="#d97706" strokeWidth={2} strokeLinecap="round" />
            <path d="M72 84.5v5M88 84.5v5M104 84.5v5" stroke="#78350f" strokeWidth={0.8} />
            <path d="M66 90v21M110 90v21" stroke="#78350f" strokeWidth={2.4} strokeLinecap="round" />
            <path d="M66 100h44" stroke="#78350f" strokeOpacity={0.45} strokeWidth={1} />
            <g className={`fish-rod ${f.dip ? 'fish-dip' : ''}`}>
              <path d="M82 62Q50 30 26 28" stroke="#b45309" strokeWidth={1.8} strokeLinecap="round" fill="none" />
            </g>
            <path className={`fish-line ${reeling ? 'fish-reeling' : ''}`} d="M26 28L24 96" stroke="#e5e5e5" strokeOpacity={0.7} strokeWidth={0.7} fill="none" />
            <g className={`fish-bobber ${f.dip ? 'fish-dip' : ''} ${reeling ? 'fish-reeling' : ''}`}>
              <circle cx={24} cy={97} r={3.2} fill="#fafafa" />
              <path d="M20.8 97a3.2 3.2 0 0 1 6.4 0z" fill="#ef4444" transform="translate(0 -0.2)" />
            </g>
            <circle className="fish-ripple" cx={24} cy={100} r={3} fill="none" stroke="#7dd3fc" strokeWidth={0.8} />
            <g key={f.bucket} className={f.bucket ? 'fish-bucket-pop' : ''}>
              <path d="M104 74h12l-1.6 12h-8.8z" fill="#475569" stroke="#94a3b8" strokeWidth={0.8} strokeLinejoin="round" />
              <text x={110} y={83.5} textAnchor="middle" fontSize={7} fontWeight={700} fill="#f1f5f9" fontFamily="ui-monospace, monospace">{f.bucket}</text>
            </g>
          </svg>
          <div className={`fish-bit ${l.cls}`} style={{ '--bit-step': '0.34s' } as CSSProperties}>
            <Bit state={l.face} pose={l.pose} size={42} title="" />
          </div>
          {f.drop && (
            <span key={f.drop.id} className="fish-drop" style={{ left: 18, top: 84, '--fx': '88px', '--fy': '-8px' } as CSSProperties}>{f.drop.item.emoji}</span>
          )}
          {f.phase === 'fish' && <button type="button" tabIndex={-1} aria-label="Bit pescando" onClick={f.click} className="fish-hit" />}
        </div>
      )}
    </div>
  );
}
