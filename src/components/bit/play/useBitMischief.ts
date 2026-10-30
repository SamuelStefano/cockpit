import { useEffect, useRef, type RefObject } from 'react';
import { MischiefScheduler, MISCHIEF_TIMING, type MischiefTiming } from './mischief-scheduler';
import { pickSkit, RANDOM_SKIT_IDS, type SkitId } from './skits';
import { useSkitStage } from './useSkitStage';
import { usePlayAllowed } from './usePlayAllowed';
import { useWordThief } from './useWordThief';

interface Args {
  // Where the thief looks for a letter (the message log).
  textRootRef?: RefObject<HTMLElement | null>;
  thinking: boolean;
  // Bumps on every new message, which also chases Bit away.
  messageCount: number;
  timing?: MischiefTiming;
}

const CALM_SKITS = RANDOM_SKIT_IDS.filter((id) => id !== 'thief');

// Not 'scroll': the thread auto-scrolls itself while streaming. A user scroll
// always arrives as wheel, touch, a key or a scrollbar press, all caught here.
const INPUT_EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;

// Idle or long-thinking chat → Bit sneaks in for one short skit, then rests for a
// long cooldown. Any sign of the user sends it running.
export function useBitMischief({ textRootRef, thinking, messageCount, timing = MISCHIEF_TIMING }: Args) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const allowed = usePlayAllowed();
  const sched = useRef<MischiefScheduler | null>(null);
  const last = useRef<SkitId | null>(null);
  const busy = useRef(thinking);
  busy.current = thinking;
  const wordEnded = useRef<() => void>(() => {});
  const stage = useSkitStage(layerRef, textRootRef, () => { sched.current?.ended(); wordEnded.current(); });
  const api = useRef(stage);
  api.current = stage;
  wordEnded.current = useWordThief({ stage, allowed, running: thinking, messageCount, stageBusy: () => !!sched.current?.isPlaying || stage.playing });

  useEffect(() => {
    const s = new MischiefScheduler({
      // While a turn runs the thread auto-scrolls under any borrowed letter.
      start: () => {
        const id = pickSkit(busy.current ? CALM_SKITS : RANDOM_SKIT_IDS, last.current);
        last.current = id;
        if (!api.current.play(id)) s.ended();
      },
      interrupt: () => (document.hidden ? api.current.abort() : api.current.hurry()),
    }, timing);
    sched.current = s;
    return () => { s.dispose(); sched.current = null; };
  }, [timing]);

  useEffect(() => { sched.current?.setEnabled(allowed); }, [allowed]);
  useEffect(() => { sched.current?.setThinking(thinking); }, [thinking]);
  useEffect(() => { sched.current?.activity(); }, [messageCount]);

  useEffect(() => {
    const poke = () => sched.current?.activity();
    for (const e of INPUT_EVENTS) window.addEventListener(e, poke, { passive: true, capture: true });
    return () => { for (const e of INPUT_EVENTS) window.removeEventListener(e, poke, { capture: true }); };
  }, []);

  return { layerRef, ...stage };
}
