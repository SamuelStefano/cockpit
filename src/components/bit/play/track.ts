import type { BitState } from '../bit-state';

export type Ease = (u: number) => number;
export const linear: Ease = (u) => u;
export const easeIn: Ease = (u) => u * u;
export const easeOut: Ease = (u) => 1 - (1 - u) * (1 - u);
export const easeInOut: Ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
export const backOut: Ease = (u) => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

// x/y are the feet (bottom-centre) of the actor in layer pixels.
export interface ActorFrame { x: number; y: number; rot: number; sx: number; sy: number; flip: 1 | -1 }
// x/y are the centre of the carried thing (letter or ball) in layer pixels.
export interface PropFrame { x: number; y: number; rot: number; s: number; o: number }

export interface Cue { at: number; face?: BitState; pose?: string; gaze?: [number, number]; prop?: string | null }

interface Seg<F> { start: number; dur: number; at: (u: number) => F }

export class Track<F> {
  private segs: Seg<F>[] = [];
  private end = 0;
  constructor(protected last: F) {}
  get duration() { return this.end; }
  get current() { return this.last; }
  add(dur: number, at: (u: number) => F): this {
    this.segs.push({ start: this.end, dur, at });
    this.end += dur;
    this.last = at(1);
    return this;
  }
  hold(ms: number): this { const f = this.last; return this.add(ms, () => f); }
  holdUntil(t: number): this { return t > this.end ? this.hold(t - this.end) : this; }
  sample(t: number): F {
    if (this.segs.length === 0) return this.last;
    if (t >= this.end) return this.last;
    let lo = 0;
    let hi = this.segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.segs[mid].start <= t) lo = mid; else hi = mid - 1;
    }
    const s = this.segs[lo];
    return s.at(s.dur === 0 ? 1 : Math.min(1, Math.max(0, (t - s.start) / s.dur)));
  }
}

const rest = (f: ActorFrame): ActorFrame => ({ ...f, rot: 0, sx: 1, sy: 1 });

export class ActorTrack extends Track<ActorFrame> {
  readonly cues: Cue[] = [];
  cue(c: Omit<Cue, 'at'>): this { this.cues.push({ at: this.duration, ...c }); return this; }
  face(flip: 1 | -1): this { const f = { ...this.current, flip }; return this.add(0, () => f); }
  // Pixels per second; the walk cycle in CSS is tuned to these speeds so feet don't skate.
  move(x: number, speed: number, y = this.current.y, ease: Ease = linear): this {
    const a = rest(this.current);
    const flip: 1 | -1 = x === a.x ? a.flip : x > a.x ? 1 : -1;
    const dur = (Math.hypot(x - a.x, y - a.y) / speed) * 1000;
    return this.add(dur, (u) => ({ ...a, flip, x: lerp(a.x, x, ease(u)), y: lerp(a.y, y, ease(u)) }));
  }
  tween(to: Partial<ActorFrame>, ms: number, ease: Ease = easeInOut): this {
    const a = this.current;
    const b = { ...a, ...to };
    return this.add(ms, (u) => {
      const e = ease(u);
      return { flip: b.flip, x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), rot: lerp(a.rot, b.rot, e), sx: lerp(a.sx, b.sx, e), sy: lerp(a.sy, b.sy, e) };
    });
  }
  // Anticipation squash, stretched flight, landing squash, settle.
  hop(height: number, ms: number, dx = 0): this {
    const a = rest(this.current);
    this.tween({ sx: 1.14, sy: 0.84 }, ms * 0.18, easeOut);
    const air = ms * 0.52;
    this.add(air, (u) => ({ ...a, x: a.x + dx * u, y: a.y - height * 4 * u * (1 - u), sx: 0.92 + 0.08 * Math.abs(2 * u - 1), sy: 1.1 - 0.1 * Math.abs(2 * u - 1) }));
    this.tween({ sx: 1.16, sy: 0.82 }, ms * 0.1, easeOut);
    return this.tween({ sx: 1, sy: 1 }, ms * 0.2, backOut);
  }
  wobble(deg: number, times: number, ms: number): this {
    const a = this.current;
    return this.add(ms, (u) => ({ ...a, rot: a.rot + deg * Math.sin(u * Math.PI * 2 * times) * (1 - u) }));
  }
}

export interface HeldBy { actor: ActorTrack; size: number }

// Where a carried thing sits: over Bit's head, lifted a bit by the raised arms.
export function headPoint(f: ActorFrame, size: number): { x: number; y: number } {
  return { x: f.x, y: f.y - size * 1.02 * f.sy };
}

export class PropTrack extends Track<PropFrame> {
  constructor(start: PropFrame, private by: HeldBy) { super(start); }
  private held(t: number, extra: Partial<PropFrame> = {}): PropFrame {
    const p = headPoint(this.by.actor.sample(t), this.by.size);
    return { x: p.x, y: p.y, rot: 0, s: 1, o: 1, ...extra };
  }
  // Arc from wherever it is now into Bit's hands; follows the actor while it moves.
  lift(ms: number, peak = 26): this {
    const a = this.current;
    const t0 = this.duration;
    return this.add(ms, (u) => {
      const h = this.held(t0 + u * ms);
      const e = easeInOut(u);
      return { x: lerp(a.x, h.x, e), y: lerp(a.y, h.y, e) - peak * 4 * u * (1 - u), rot: lerp(a.rot, 0, e) + 360 * e, s: lerp(a.s, 1.15, Math.sin(u * Math.PI)), o: 1 };
    });
  }
  carry(until: number, bob = 2.5): this {
    const t0 = this.duration;
    const ms = Math.max(0, until - t0);
    return this.add(ms, (u) => {
      const t = t0 + u * ms;
      return this.held(t, { y: this.held(t).y + Math.sin(t / 90) * bob, rot: Math.sin(t / 140) * 8 });
    });
  }
  toss(ms: number, height: number, spins = 1): this {
    const t0 = this.duration;
    return this.add(ms, (u) => {
      const h = this.held(t0 + u * ms);
      return { ...h, y: h.y - height * 4 * u * (1 - u), rot: 360 * spins * u };
    });
  }
  // Back home on an arc, then a tiny settle so the drop reads as "put in place".
  place(home: PropFrame, ms: number, peak = 30): this {
    const a = this.current;
    this.add(ms * 0.8, (u) => {
      const e = easeInOut(u);
      return { x: lerp(a.x, home.x, e), y: lerp(a.y, home.y, e) - peak * 4 * u * (1 - u), rot: lerp(a.rot % 360, 0, e), s: lerp(a.s, 1, e), o: 1 };
    });
    return this.add(ms * 0.2, (u) => ({ ...home, s: 1 + 0.18 * Math.sin(u * Math.PI) }));
  }
}
