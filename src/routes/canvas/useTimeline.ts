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

// `now` is expected to be a value stable across renders (captured once by the
// caller, same pattern as useCanvasRoute's own `now`) — a moving `now` would
// make the slider's range drift under the user's thumb mid-drag.
export function useTimeline(now: number): Timeline {
  const [live, setLive] = useState(true);
  const [scrubbed, setScrubbed] = useState(now);
  const [playing, setPlaying] = useState(false);
  const rangeStart = now - TIMELINE_WINDOW_MS;

  const setT = (v: number) => {
    setPlaying(false);
    setLive(false);
    setScrubbed(clampToRange(v, rangeStart, now));
  };
  const goLive = () => { setPlaying(false); setLive(true); };
  const play = () => { setLive(false); setPlaying(true); };
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
