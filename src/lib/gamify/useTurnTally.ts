import { useEffect, useRef } from 'react';
import { usePersisted } from '../persist';
import { fireConfetti } from '../../components/primitives/confetti-bus';
import { subscribeTurnDone } from './turn-done-bus';
import { EMPTY_TALLY, TURN_TALLY_KEY, isMilestone, liveStreak, recordTurn, turnsOn, type TurnTally } from './turn-tally';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Where the burst comes from: the Bit that is on screen (sidebar or mobile header).
function bitOriginX(): number {
  const el = document.querySelector('[data-turn-bit]');
  if (!el || !window.innerWidth) return 0.5;
  const r = el.getBoundingClientRect();
  return Math.min(1, Math.max(0, (r.left + r.width / 2) / window.innerWidth));
}

// Read-only view for any component: same persisted key, kept in sync by usePersisted.
export function useTurnTallyView(now = Date.now()): { streak: number; turns: number; best: number } {
  const [t] = usePersisted<TurnTally>(TURN_TALLY_KEY, EMPTY_TALLY);
  return { streak: liveStreak(t, now), turns: turnsOn(t, now), best: t.best };
}

// Mounted once (App): turns a finished turn into the tally plus a small reward.
export function useTurnTally(): void {
  const [tally, setTally] = usePersisted<TurnTally>(TURN_TALLY_KEY, EMPTY_TALLY);
  const ref = useRef(tally);
  ref.current = tally;
  useEffect(() => subscribeTurnDone(() => {
    const next = recordTurn(ref.current, Date.now());
    setTally(next);
    if (reducedMotion()) return;
    navigator.vibrate?.(30);
    if (isMilestone(next.turnsToday)) fireConfetti({ count: 90, spread: 1 });
    else fireConfetti({ count: 24, spread: 0.3, originX: bitOriginX() });
  }), [setTally]);
}
