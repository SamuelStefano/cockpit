import { useEffect, useState } from 'react';
import { TIMELINE_WINDOW_MS } from './canvas-timeline';

const PLAY_STEP_MS = 5 * 60_000; // canvas-minutes advanced per tick
const PLAY_TICK_MS = 200; // wall-clock ms per tick

export function clampToRange(t: number, start: number, end: number): number {
  return Math.min(end, Math.max(start, t));
}

// One playback tick: advance by PLAY_STEP_MS, clamped to `end`. `done` says
// the scrub reached "now" and playback should stop there rather than loop.
export function nextPlayT(t: number, end: number): { t: number; done: boolean } {
  const next = t + PLAY_STEP_MS;
  return next >= end ? { t: end, done: true } : { t: next, done: false };
}

export interface Timeline {
  live: boolean;
  t: number; // current scrub position; equals `now` whenever `live`
  playing: boolean;
  rangeStart: number;
  rangeEnd: number;
  setT: (t: number) => void;
  play: () => void;
  pause: () => void;
  goLive: () => void;
}

// `now` is owned by the hook, not a prop: it stays fixed WHILE scrubbing or
// playing (so the range never drifts under the user's thumb mid-drag), but
// gets re-captured at the two moments staleness would otherwise show —
// leaving live to start a scrub, and returning to live — rather than frozen
// forever at mount.
export function useTimeline(): Timeline {
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState(true);
  const [scrubbed, setScrubbed] = useState(now);
  const [playing, setPlaying] = useState(false);
  const rangeStart = now - TIMELINE_WINDOW_MS;

  const setT = (v: number) => {
    setPlaying(false);
    const freshNow = live ? Date.now() : now;
    if (live) { setLive(false); setNow(freshNow); }
    setScrubbed(clampToRange(v, freshNow - TIMELINE_WINDOW_MS, freshNow));
  };
  const goLive = () => { setPlaying(false); setLive(true); setNow(Date.now()); };
  // From live, start the replay a full window back from the real now: `now` and
  // `scrubbed` were frozen at the last capture, so play jumped to a stale time
  // and ended short of the present, stuck in "vendo o passado".
  const play = () => {
    if (live) { const n = Date.now(); setNow(n); setScrubbed(n - TIMELINE_WINDOW_MS); }
    setLive(false);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setScrubbed((cur) => {
        const { t: next, done } = nextPlayT(cur, now);
        if (done) setPlaying(false);
        return next;
      });
    }, PLAY_TICK_MS);
    return () => clearInterval(id);
  }, [playing, now]);

  return { live, t: live ? now : scrubbed, playing, rangeStart, rangeEnd: now, setT, play, pause, goLive };
}
