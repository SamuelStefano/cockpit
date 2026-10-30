import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeRewards } from './game-bus';
import { subscribeArcade } from './arcade-bus';
import { turnXp } from './reward-view';
import { useGameState } from './useGameState';
import { sfx } from './sfx';

export const FLICKER_MS = 700;

export function useArcadeButton() {
  const [open, setOpenState] = useState(false);
  const [flicker, setFlicker] = useState(false);
  const state = useGameState();
  const timer = useRef(0);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    if (v) sfx.tick();
  }, []);

  useEffect(() => subscribeArcade('popover', () => setOpen(true)), [setOpen]);
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

  return { open, setOpen, flicker, state };
}
