import { Bit } from '../Bit';
import { usePlayground, PLAY_BIT_SIZE } from './usePlayground';
import { usePlayAllowed } from './usePlayAllowed';
import { BALL_SIZE } from './playground';
import '../bit-play.css';

const OFFSTAGE = 'translate3d(-9999px, 0, 0)';

// New-chat greeting: Bit potters about on a little floor strip. With play off (or
// reduced motion) it is the old static waving Bit.
export function BitPlayground() {
  const allowed = usePlayAllowed();
  const p = usePlayground(allowed);
  if (!allowed) return <div className="bit-pop bit-greet mb-3"><Bit state="wave" size={96} title="Bora?" /></div>;
  return (
    <div ref={p.stageRef} aria-hidden className="bit-stage pointer-events-none relative mb-2 h-[132px] w-full max-w-[560px] shrink-0">
      <div className="absolute inset-x-6 bottom-[5px] h-px bg-gradient-to-r from-transparent via-neutral-700/70 to-transparent" />
      <div ref={p.ballRef} className="absolute left-0 top-0" style={{ width: BALL_SIZE, height: BALL_SIZE, transform: OFFSTAGE }}>
        <svg viewBox="0 0 24 24" width={BALL_SIZE} height={BALL_SIZE}>
          <circle cx={12} cy={12} r={11} fill="#fde68a" stroke="#c2410c" strokeWidth={1.6} />
          <path d="M1.5 12h21M12 1.5c-4 4-4 17 0 21M12 1.5c4 4 4 17 0 21" stroke="#f97316" strokeWidth={1.6} fill="none" />
        </svg>
      </div>
      <div ref={p.actorRef} className={`bit-actor ${p.look.pose}`} style={{ width: PLAY_BIT_SIZE, height: PLAY_BIT_SIZE, transform: OFFSTAGE }}>
        <Bit state={p.look.face} pose={p.look.pose} size={PLAY_BIT_SIZE} title="Bora?" />
      </div>
    </div>
  );
}
