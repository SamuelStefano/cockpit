import { useEffect, useRef, useState } from 'react';
import { subscribeRewards } from './game-bus';
import { turnXp } from './reward-view';

export const FLICKER_MS = 700;

export function useArcadeButton() {
  const [flicker, setFlicker] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    const off = subscribeRewards((rewards) => {
      if (turnXp(rewards) <= 0) return;
      setFlicker(false);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFlicker(true), 0);
      window.setTimeout(() => setFlicker(false), FLICKER_MS + 20);
    });
    return () => { off(); window.clearTimeout(timer.current); };
  }, []);

  return { flicker };
}
