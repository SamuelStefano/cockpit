import type { CSSProperties, RefObject } from 'react';
import { Bit } from '../Bit';
import { BitBroom } from './BitBroom';
import type { StageLook } from './useSkitStage';
import '../bit-play.css';

interface BitStageLayerProps {
  layerRef: RefObject<HTMLDivElement | null>;
  actorRef: RefObject<HTMLDivElement | null>;
  letterRef: RefObject<HTMLSpanElement | null>;
  look: StageLook | null;
  size: number;
}

const OFFSTAGE = 'translate3d(-9999px, 0, 0)';

// Decoration only: hidden from assistive tech, never takes a click, and sits over
// the thread without changing its layout. Children exist only while a skit runs.
export function BitStageLayer({ layerRef, actorRef, letterRef, look, size }: BitStageLayerProps) {
  const gaze = { '--bit-gx': `${look?.gaze[0] ?? 0}px`, '--bit-gy': `${look?.gaze[1] ?? 0}px` } as CSSProperties;
  return (
    <div ref={layerRef} aria-hidden className="bit-stage pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {look && (
        <div ref={actorRef} className={`bit-actor ${look.pose}`} style={{ width: size, height: size, transform: OFFSTAGE, ...gaze }}>
          <Bit state={look.face} pose={look.pose} size={size} title="" />
          {look.prop === 'broom' && <BitBroom />}
        </div>
      )}
      {look?.letter && (
        <span
          ref={letterRef} className="bit-stage-letter"
          style={{ transform: OFFSTAGE, width: look.letter.w, height: look.letter.h, lineHeight: `${look.letter.h}px`, fontFamily: look.letter.font.family, fontSize: look.letter.font.size, fontWeight: look.letter.font.weight, fontStyle: look.letter.font.style, color: look.letter.font.color }}
        >
          {look.letter.char}
        </span>
      )}
    </div>
  );
}
