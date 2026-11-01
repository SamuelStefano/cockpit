import { useEffect, useRef } from 'react';
import type { BaseEngine } from './engine/engine';
import type { LiveFloor } from './liveAdapter';
import { parseSessionParam, withSessionParam } from './sessionLink';

// Keeps the open desk in the URL (?session=<id>) so a reload lands on the same desk.
// `floorLoaded` is true once the client has sessions to judge against; before that the link waits.
export function useSessionLink(engine: BaseEngine | null, live: LiveFloor, selected: string | undefined, floorLoaded: boolean) {
  const pending = useRef<string | null | undefined>(undefined);
  if (pending.current === undefined) pending.current = parseSessionParam(location.search);
  const wasSelected = useRef(false);

  useEffect(() => {
    const id = pending.current;
    if (!engine || !id || !floorLoaded) return;
    pending.current = null;
    const agent = live.floor.agents.find((a) => a.sessionId === id);
    if (agent) engine.select(agent.id);
    else {
      engine.toast('Session is not on the floor');
      history.replaceState(history.state, '', withSessionParam(location.href, null));
    }
  }, [engine, live, floorLoaded]);

  useEffect(() => {
    // While the link is still waiting to be applied, nothing is selected and the param must stay.
    if (pending.current && !selected) return;
    // Picking a desk by hand before the link applied cancels the link.
    if (selected) pending.current = null;
    if (selected) wasSelected.current = true; else if (!wasSelected.current) return; else wasSelected.current = false;
    const next = withSessionParam(location.href, selected ?? null);
    if (next !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', next);
  }, [selected]);
}
