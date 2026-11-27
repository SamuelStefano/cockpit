import { useEffect, useRef, useState, type RefObject } from 'react';
import { BaseEngine } from './engine/engine';
import { emptyHud, type HudState } from './hudState';
import type { LiveActions } from './useLiveFeed';
import type { LiveFloor } from './liveAdapter';
import { createStore } from './store';
import type { BaseMode } from './types';

export function useBaseEngine(worldRef: RefObject<HTMLDivElement | null>, labelsRef: RefObject<HTMLDivElement | null>, live: LiveFloor, actions: LiveActions, initialMode: BaseMode, enabled: boolean) {
  const [store] = useState(() => createStore<HudState>(emptyHud(initialMode)));
  const [engine, setEngine] = useState<BaseEngine | null>(null);
  const [failed, setFailed] = useState(false);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    if (!enabled || !worldRef.current || !labelsRef.current) return;
    let e: BaseEngine;
    try {
      e = new BaseEngine(worldRef.current, labelsRef.current, store, { act: (a) => actionsRef.current.act(a) });
    } catch (err) {
      // No WebGL (headless, blocklisted GPU): the page says so instead of crashing the route.
      console.warn('[base] WebGL unavailable', err);
      setFailed(true);
      return;
    }
    e.setLive(liveRef.current);
    e.setMode(initialMode);
    setEngine(e);
    return () => { setEngine(null); e.dispose(); };
  }, [enabled, worldRef, labelsRef, store, initialMode]);

  useEffect(() => { engine?.setLive(live); }, [engine, live]);
  return { store, engine, failed };
}
