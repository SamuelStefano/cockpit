import { loadPref } from '../lib/persist';
import { GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT, GAME_SOUND_KEY, GAME_SOUND_DEFAULT, NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT } from '../lib/prefs';

type Wave = OscillatorType;
interface Note { f: number; at: number; dur: number; type?: Wave; vol?: number; slideTo?: number }

// game: rewards, played while the tab is visible.
// ambient: little UI flourishes, at most one per AMBIENT_GAP_MS.
// turn: end-of-turn cues, the only ones allowed while the tab is hidden.
type Kind = 'game' | 'ambient' | 'turn';

export const MASTER = 0.5;
export const AMBIENT_GAP_MS = 1500;

let ctx: AudioContext | null = null;
let lastAmbient = -Infinity;

export function resetSfxForTests(): void {
  ctx = null;
  lastAmbient = -Infinity;
}

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = typeof window === 'undefined'
    ? undefined
    : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    // One shared context: browsers cap live contexts, and sounds fire often.
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

export const soundOn = (): boolean => loadPref(GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT) && loadPref(GAME_SOUND_KEY, GAME_SOUND_DEFAULT);

const hidden = (): boolean => typeof document !== 'undefined' && document.hidden;

// notify.ts already beeps for a finished turn in a hidden tab: do not double it.
const notifyBeeps = (): boolean => hidden() && loadPref(NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT);

// Browsers keep an AudioContext suspended until a gesture. The first pointer or key
// press resumes it; before that sounds are dropped, never queued to burst later.
let unlockInstalled = false;
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const events = ['pointerdown', 'keydown'] as const;
  const unlock = () => {
    for (const e of events) window.removeEventListener(e, unlock, true);
    unlockInstalled = false;
    if (!soundOn()) return;
    try { void getCtx()?.resume(); } catch { /* best-effort */ }
  };
  for (const e of events) window.addEventListener(e, unlock, { capture: true, passive: true });
}
installAudioUnlock();

function play(notes: Note[], kind: Kind = 'ambient'): void {
  if (!soundOn()) return;
  if (kind === 'turn' ? notifyBeeps() : hidden()) return;
  const now = Date.now();
  if (kind === 'ambient') {
    if (now - lastAmbient < AMBIENT_GAP_MS) return;
    lastAmbient = now;
  }
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state !== 'running') { void c.resume(); return; }
    const t0 = c.currentTime;
    for (const n of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = t0 + n.at;
      osc.type = n.type ?? 'square';
      osc.frequency.setValueAtTime(n.f, t);
      if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, t + n.dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime((n.vol ?? 0.05) * MASTER, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + n.dur + 0.02);
    }
  } catch {
    /* best-effort */
  }
}

const arp = (freqs: number[], step: number, dur: number, type: Wave = 'square'): Note[] => freqs.map((f, i) => ({ f, at: i * step, dur, type }));
const game = (notes: Note[]) => play(notes, 'game');

export const sfx = {
  coin: () => game([{ f: 988, at: 0, dur: 0.07 }, { f: 1319, at: 0.07, dur: 0.18 }]),
  levelUp: () => game(arp([523, 659, 784, 1047, 1319], 0.09, 0.14)),
  achievement: () => game([...arp([784, 988, 1175], 0.1, 0.12), { f: 1568, at: 0.32, dur: 0.4, type: 'triangle', vol: 0.07 }]),
  error: () => game([{ f: 140, at: 0, dur: 0.18, type: 'sawtooth', slideTo: 90 }, { f: 110, at: 0.12, dur: 0.2, type: 'sawtooth', slideTo: 70 }]),
  send: () => play([{ f: 520, at: 0, dur: 0.07, type: 'sine', slideTo: 720, vol: 0.05 }]),
  turnDone: () => play([{ f: 523, at: 0, dur: 0.16, type: 'sine', vol: 0.06 }, { f: 784, at: 0.12, dur: 0.28, type: 'sine', vol: 0.06 }], 'turn'),
  turnError: () => play([{ f: 130, at: 0, dur: 0.22, type: 'sine', slideTo: 70, vol: 0.09 }], 'turn'),
  tick: () => play([{ f: 1100, at: 0, dur: 0.03, type: 'triangle', vol: 0.04 }]),
  splash: () => play([{ f: 700, at: 0, dur: 0.12, type: 'sine', slideTo: 220, vol: 0.05 }, { f: 420, at: 0.06, dur: 0.16, type: 'triangle', slideTo: 160, vol: 0.04 }]),
  reel: () => play(arp([420, 480, 540, 600, 680], 0.05, 0.05, 'triangle').map((n) => ({ ...n, vol: 0.035 }))),
  giggle: () => play([{ f: 900, at: 0, dur: 0.07, type: 'sine', slideTo: 1500, vol: 0.04 }, { f: 1000, at: 0.1, dur: 0.07, type: 'sine', slideTo: 1650, vol: 0.04 }, { f: 1150, at: 0.2, dur: 0.09, type: 'sine', slideTo: 1800, vol: 0.04 }]),
};

export type SfxName = keyof typeof sfx;
