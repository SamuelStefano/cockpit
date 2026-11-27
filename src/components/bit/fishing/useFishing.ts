import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { usePlayAllowed } from '../play/usePlayAllowed';
import { useCoarse } from '../../primitives/useCoarse';
import { useGameEnabled } from '../../../game/useGameState';
import { recordGameEvent } from '../../../game/game-bus';
import { sfx } from '../../../game/sfx';
import { FishingSession } from './fishing-session';
import { BITE_DELAY_DIP_MS, marginFits, type Catch, type FishPhase } from './fishing';

const DROP_MS = 1400;

export interface FishDrop { id: number; item: Catch }

function useRoomBeside(layerRef: RefObject<HTMLElement | null>): boolean {
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const el = layerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setFits(marginFits(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layerRef]);
  return fits;
}

// Bit fishes beside the message column while a turn runs, but only on a layout with
// room for it, with play on and the game enabled. React re-renders only on phase,
// dip, drop and bucket changes (a handful per turn).
export function useFishing(layerRef: RefObject<HTMLElement | null>, running: boolean, forceRoom = false) {
  const allowed = usePlayAllowed();
  const gameOn = useGameEnabled();
  const coarse = useCoarse();
  const fits = useRoomBeside(layerRef);
  const [phase, setPhase] = useState<FishPhase>('off');
  const [dip, setDip] = useState(false);
  const [drop, setDrop] = useState<FishDrop | null>(null);
  const [bucket, setBucket] = useState(0);
  const session = useRef<FishingSession | null>(null);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  useEffect(() => {
    const s = new FishingSession({
      phase: (p) => {
        setPhase(p);
        if (p === 'enter') setBucket(0);
        if (p === 'reel') sfx.reel();
      },
      bite: () => { setDip(true); later(() => setDip(false), BITE_DELAY_DIP_MS + 100); },
      caught: (item) => {
        setDip(false);
        setBucket((n) => n + 1);
        const id = ++seq.current;
        setDrop({ id, item });
        later(() => setDrop((d) => (d?.id === id ? null : d)), DROP_MS);
        sfx.splash();
        recordGameEvent({ type: 'fish_caught', rare: item.id === 'star' });
      },
    });
    session.current = s;
    return () => { s.stop(); session.current = null; for (const t of timers.current) clearTimeout(t); timers.current = []; };
  }, []);

  const room = allowed && gameOn && (forceRoom || (!coarse && fits));
  useEffect(() => {
    if (!room) session.current?.stop();
    else session.current?.setActive(running);
  }, [room, running]);

  const click = useCallback(() => { session.current?.click(); }, []);
  return { phase, dip, drop, bucket, click };
}
