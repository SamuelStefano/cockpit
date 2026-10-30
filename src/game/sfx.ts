import { loadPref } from '../lib/persist';
import { GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT, GAME_SOUND_KEY, GAME_SOUND_DEFAULT } from '../lib/prefs';

type Wave = OscillatorType;
interface Note { f: number; at: number; dur: number; type?: Wave; vol?: number; slideTo?: number }

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = typeof window === 'undefined'
    ? undefined
    : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    // One shared context: browsers cap live contexts, and the runner plays dozens of blips.
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

export const soundOn = (): boolean => loadPref(GAME_ENABLED_KEY, GAME_ENABLED_DEFAULT) && loadPref(GAME_SOUND_KEY, GAME_SOUND_DEFAULT);

function play(notes: Note[]): void {
  if (!soundOn()) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') void c.resume();
    const t0 = c.currentTime;
    for (const n of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = t0 + n.at;
      osc.type = n.type ?? 'square';
      osc.frequency.setValueAtTime(n.f, t);
      if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, t + n.dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(n.vol ?? 0.05, t + 0.01);
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

export const sfx = {
  coin: () => play([{ f: 988, at: 0, dur: 0.07 }, { f: 1319, at: 0.07, dur: 0.18 }]),
  levelUp: () => play(arp([523, 659, 784, 1047, 1319], 0.09, 0.14)),
  achievement: () => play([...arp([784, 988, 1175], 0.1, 0.12), { f: 1568, at: 0.32, dur: 0.4, type: 'triangle', vol: 0.07 }]),
  error: () => play([{ f: 140, at: 0, dur: 0.18, type: 'sawtooth', slideTo: 90 }, { f: 110, at: 0.12, dur: 0.2, type: 'sawtooth', slideTo: 70 }]),
  jump: () => play([{ f: 320, at: 0, dur: 0.14, slideTo: 760, vol: 0.04 }]),
  gameOver: () => play(arp([392, 330, 262, 196], 0.14, 0.2, 'triangle')),
};

export type SfxName = keyof typeof sfx;
