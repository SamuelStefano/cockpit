import { useEffect, useRef } from 'react';
import { isTypingTarget } from '../../../game/eggs';
import { movedEnough, wordThiefReady } from './word-thief';

const POLL_MS = 2000;

interface Stage { play: (id: 'wordthief') => boolean; hurry: () => void; abort: () => void }

interface Args {
  stage: Stage;
  allowed: boolean;
  running: boolean;
  messageCount: number;
  stageBusy: () => boolean;
}

// The mouse sat still for 25 s: Bit runs in, steals a word and flees off screen. When
// the pointer moves again the word comes flying back and bounces into place.
// Returns the callback the stage must call when any skit leaves it.
export function useWordThief({ stage, allowed, running, messageCount, stageBusy }: Args): () => void {
  const api = useRef(stage);
  api.current = stage;
  const busy = useRef(stageBusy);
  busy.current = stageBusy;
  const live = useRef({ allowed, running });
  live.current = { allowed, running };
  const s = useRef({ lastMove: Date.now(), mouseSeen: false, lastKey: 0, lastEnd: 0, active: false, x: 0, y: 0 });

  useEffect(() => {
    const st = s.current;
    const release = () => { if (st.active) api.current.hurry(); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (!st.mouseSeen || movedEnough(e.clientX - st.x, e.clientY - st.y)) {
        st.mouseSeen = true;
        st.lastMove = Date.now();
        release();
      }
      st.x = e.clientX;
      st.y = e.clientY;
    };
    const onActivity = () => { st.lastMove = Date.now(); release(); };
    const onKey = () => { st.lastKey = Date.now(); release(); };
    // Typed keys in a field are the user working: this only reads timestamps and never
    // looks at the key, so nothing the user types is touched.
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onActivity, { passive: true, capture: true });
    window.addEventListener('wheel', onActivity, { passive: true, capture: true });
    window.addEventListener('touchstart', onActivity, { passive: true, capture: true });
    window.addEventListener('keydown', onKey, { passive: true, capture: true });
    const poll = window.setInterval(() => {
      if (st.active) return;
      const now = Date.now();
      const sel = window.getSelection();
      const focus = document.activeElement;
      const ok = wordThiefReady({
        now, lastMove: st.lastMove, mouseSeen: st.mouseSeen, hidden: document.hidden,
        selectionActive: !!sel && !sel.isCollapsed, composerFocused: isTypingTarget(focus), lastKey: st.lastKey,
        lastEnd: st.lastEnd, stageBusy: busy.current(), turnRunning: live.current.running, allowed: live.current.allowed,
      });
      if (ok && api.current.play('wordthief')) st.active = true;
    }, POLL_MS);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('pointermove', onMove);
      for (const [e, fn] of [['pointerdown', onActivity], ['wheel', onActivity], ['touchstart', onActivity], ['keydown', onKey]] as const) window.removeEventListener(e, fn, { capture: true });
    };
  }, []);

  // The text may have moved (new message, a turn starting) or Bit may not play any
  // more: the word goes straight home, no animation.
  useEffect(() => {
    const st = s.current;
    if (st.active && (!allowed || running)) { api.current.abort(); st.active = false; st.lastEnd = Date.now(); }
  }, [allowed, running]);
  useEffect(() => {
    const st = s.current;
    if (st.active) { api.current.abort(); st.active = false; st.lastEnd = Date.now(); }
  }, [messageCount]);

  return () => { const st = s.current; if (st.active) { st.active = false; st.lastEnd = Date.now(); } };
}
