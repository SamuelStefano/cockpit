import { ActorTrack, PropTrack, easeIn, easeOut, easeInOut, backOut, type ActorFrame, type PropFrame } from './track';

export type SkitId = 'thief' | 'wordthief' | 'peek' | 'slide' | 'sweep';
export const SKIT_IDS: SkitId[] = ['thief', 'wordthief', 'peek', 'slide', 'sweep'];
// The word thief has its own trigger (the mouse going idle), so the random pool skips it.
export const RANDOM_SKIT_IDS: SkitId[] = SKIT_IDS.filter((id) => id !== 'wordthief');
export const SKIT_LABEL: Record<SkitId, string> = {
  thief: 'Ladrão de letra',
  wordthief: 'Ladrão de palavra (mouse parado)',
  peek: 'Espiando do composer',
  slide: 'Escorrega na barra',
  sweep: 'Faxina com vassourinha',
};

// Pace of each gait in px/s, matched to the step periods in bit-play.css.
export const SNEAK = 190;
export const WALK = 120;
export const RUN = 300;

export interface Stage {
  w: number;
  h: number;
  size: number;
  // Centre of the borrowed glyph, in layer pixels (thief only).
  letter?: { x: number; y: number; h: number; w?: number };
}

export interface Skit {
  id: SkitId;
  duration: number;
  actor: ActorTrack;
  letter?: PropTrack;
  prop?: 'broom';
  sfx?: { at: number; name: 'giggle' }[];
}

const frame = (x: number, y: number, flip: 1 | -1): ActorFrame => ({ x, y, rot: 0, sx: 1, sy: 1, flip });
const home = (l: NonNullable<Stage['letter']>): PropFrame => ({ x: l.x, y: l.y, rot: 0, s: 1, o: 1 });

export const THIEF_DROP = 0.84;

// The thief stands beside the word, one head below the line, so the lifted letter
// travels up into its hands instead of through its face.
export function thiefFeet(s: Stage): { x: number; y: number; side: 1 | -1 } {
  const l = s.letter!;
  const side: 1 | -1 = l.x > s.w / 2 ? -1 : 1;
  return { x: l.x - side * s.size * 0.46, y: Math.min(s.h - 4, l.y + l.h / 2 + s.size * THIEF_DROP), side };
}

function thief(s: Stage): Skit {
  const l = s.letter!;
  const { x: standX, y: floor, side } = thiefFeet(s);
  const enterX = side === 1 ? -s.size : s.w + s.size;
  const escapeX = side === 1 ? Math.max(s.size * 0.7, standX - 180) : Math.min(s.w - s.size * 0.7, standX + 180);
  const a = new ActorTrack(frame(enterX, floor, side === 1 ? 1 : -1));
  a.cue({ face: 'sneaky', pose: 'bit-walking bit-tiptoe' }).move(standX, SNEAK)
    .cue({ face: 'idle', pose: '', gaze: [side * 3, -4] }).hold(280)
    .cue({ face: 'sneaky', pose: 'bit-reach' }).tween({ sx: 1.1, sy: 0.88 }, 160, easeOut).tween({ sx: 0.96, sy: 1.06 }, 140, backOut);
  const grab = a.duration;
  a.cue({ pose: 'bit-carry', gaze: [0, 0] }).tween({ sx: 1, sy: 1 }, 260).hop(14, 420)
    .cue({ face: 'happy', pose: 'bit-running bit-carry' }).move(escapeX, RUN * 0.85)
    .cue({ face: 'surprised', pose: 'bit-carry' }).tween({ rot: side * 38 }, 140, easeIn).tween({ rot: side * -10 }, 220, backOut).tween({ rot: 0 }, 160)
    .face(side === 1 ? -1 : 1);
  const trip = a.duration - 520;
  a.cue({ face: 'sneaky', pose: 'bit-juggle' }).hold(1100)
    .cue({ face: 'idle', pose: 'bit-walking bit-carry' }).move(standX, WALK * 1.3).face(side === 1 ? 1 : -1)
    .cue({ face: 'happy', pose: 'bit-reach' }).tween({ sx: 1.08, sy: 0.9 }, 140, easeOut).tween({ sx: 1, sy: 1 }, 200, backOut);
  const put = a.duration - 340;
  a.hold(260).cue({ face: 'wave', pose: '' }).hold(700)
    .cue({ face: 'happy', pose: 'bit-walking' }).move(enterX, RUN * 0.7);
  const letter = new PropTrack(home(l), { actor: a, size: s.size, heldScale: 1.7 })
    .holdUntil(grab).lift(380).carry(trip).toss(560, 70, 2).carry(trip + 560 + 60)
    .toss(360, 42).toss(360, 42, -1).carry(put).place(home(l), 400).holdUntil(a.duration);
  return { id: 'thief', duration: a.duration, actor: a, letter, sfx: [{ at: grab + 300, name: 'giggle' }] };
}

// How long Bit keeps the word if the mouse never moves; it always gives it back.
export const WORD_HOLD_MS = 20_000;

// Steals a whole word and runs off screen with it. The mouse moving swaps this for
// buildExit, which throws the word back; if nobody comes back Bit returns it himself.
function wordthief(s: Stage): Skit {
  const l = s.letter!;
  const { x: standX, y: floor, side } = thiefFeet(s);
  const enterX = side === 1 ? -s.size : s.w + s.size;
  const a = new ActorTrack(frame(enterX, floor, side === 1 ? 1 : -1));
  a.cue({ face: 'sneaky', pose: 'bit-walking bit-tiptoe' }).move(standX, SNEAK)
    .cue({ face: 'idle', pose: '', gaze: [side * 3, -4] }).hold(280)
    .cue({ face: 'sneaky', pose: 'bit-reach' }).tween({ sx: 1.1, sy: 0.88 }, 160, easeOut).tween({ sx: 0.96, sy: 1.06 }, 140, backOut);
  const grab = a.duration;
  a.cue({ pose: 'bit-carry', gaze: [0, 0] }).tween({ sx: 1, sy: 1 }, 260).hop(14, 420)
    .cue({ face: 'happy', pose: 'bit-running bit-carry' }).move(enterX, RUN)
    .cue({ face: 'sneaky', pose: 'bit-carry' }).hold(WORD_HOLD_MS)
    .cue({ face: 'idle', pose: 'bit-walking bit-carry' }).move(standX, WALK * 1.3).face(side)
    .cue({ face: 'happy', pose: 'bit-reach' }).tween({ sx: 1.08, sy: 0.9 }, 140, easeOut).tween({ sx: 1, sy: 1 }, 200, backOut);
  const put = a.duration - 340;
  a.hold(260).cue({ face: 'wave', pose: '' }).hold(700)
    .cue({ face: 'happy', pose: 'bit-walking' }).move(enterX, RUN * 0.7);
  const letter = new PropTrack(home(l), { actor: a, size: s.size, heldScale: 1.1 })
    .holdUntil(grab).lift(380).carry(put).place(home(l), 400).holdUntil(a.duration);
  return { id: 'wordthief', duration: a.duration, actor: a, letter, sfx: [{ at: grab + 300, name: 'giggle' }] };
}

function peek(s: Stage): Skit {
  const x = Math.min(s.w - s.size, Math.max(s.size, s.w * 0.62));
  const hidden = s.h + s.size * 1.05;
  const up = s.h + s.size * 0.24;
  const a = new ActorTrack(frame(x, hidden, -1));
  a.cue({ face: 'idle', pose: '' }).hold(200).tween({ y: up + 14 }, 500, easeOut)
    .cue({ gaze: [-4, -2] }).hold(450).tween({ y: up }, 260, backOut)
    .cue({ gaze: [4, -2] }).hold(650)
    .cue({ gaze: [0, 2] }).hold(350)
    .cue({ face: 'wave', gaze: [0, 0] }).hold(1100)
    .cue({ face: 'happy' }).hop(10, 420)
    .cue({ face: 'surprised' }).hold(220).tween({ y: hidden, sx: 0.9, sy: 1.1 }, 320, easeIn);
  return { id: 'peek', duration: a.duration, actor: a };
}

function slide(s: Stage): Skit {
  const x = s.w - s.size * 0.42;
  const a = new ActorTrack({ ...frame(x, -6, -1), sx: 1.05, sy: 0.9 });
  a.cue({ face: 'idle', pose: 'bit-sit' }).hold(200).tween({ y: s.size * 0.95 }, 420, backOut)
    .cue({ gaze: [0, 4] }).hold(500)
    .cue({ face: 'happy', pose: 'bit-sit bit-cheer', gaze: [0, 0] }).tween({ y: s.h - 4, rot: -6 }, 1300, easeIn)
    .cue({ face: 'dizzy', pose: '' }).tween({ sx: 1.25, sy: 0.75, rot: 0 }, 110, easeOut).tween({ sx: 1, sy: 1 }, 260, backOut)
    .wobble(9, 3, 900)
    .cue({ face: 'happy' }).hop(16, 460)
    .cue({ face: 'idle', pose: 'bit-walking' }).move(s.w - s.size * 1.6, WALK)
    .cue({ face: 'wave', pose: '' }).hold(600)
    .cue({ face: 'happy', pose: 'bit-running' }).move(s.w + s.size, RUN);
  return { id: 'slide', duration: a.duration, actor: a };
}

function sweep(s: Stage): Skit {
  const floor = s.h - 4;
  const a = new ActorTrack(frame(-s.size, floor, 1));
  const mid = Math.min(s.w * 0.55, s.w - s.size * 2);
  a.cue({ face: 'idle', pose: 'bit-walking bit-broom' }).move(s.size * 1.2, WALK)
    .cue({ face: 'sneaky', pose: 'bit-sweeping' }).move(mid, 70, floor, easeInOut)
    .cue({ face: 'surprised', pose: 'bit-broom' }).tween({ rot: -10, sy: 1.06 }, 380, easeOut)
    .cue({ face: 'dizzy', pose: 'bit-broom bit-sneeze' }).tween({ rot: 16, sx: 1.1, sy: 0.88 }, 110, easeIn).tween({ rot: 0, sx: 1, sy: 1 }, 380, backOut)
    .cue({ face: 'happy', pose: 'bit-broom' }).hold(500)
    .cue({ face: 'idle', pose: 'bit-walking bit-broom' }).move(s.w + s.size, WALK * 1.4);
  return { id: 'sweep', duration: a.duration, actor: a, prop: 'broom' };
}

const BUILDERS: Record<SkitId, (s: Stage) => Skit> = { thief, wordthief, peek, slide, sweep };

export function buildSkit(id: SkitId, s: Stage): Skit {
  return BUILDERS[id](s);
}

// Caught mid-act: a startled hop and a dash to the nearest edge. Short on purpose —
// the user wants the screen back. A borrowed letter snaps home at once (the caller
// drops it), since the scroll that caught Bit may already have moved the text.
export function buildExit(id: SkitId, s: Stage, from: ActorFrame, held?: PropFrame): Skit {
  const a = new ActorTrack({ ...from, rot: 0 });
  const toRight = from.x > s.w / 2;
  const below = from.y > s.h + 2;
  a.cue({ face: 'surprised', pose: '', gaze: [0, 0] }).tween({ sx: 1, sy: 1 }, 60).hop(12, 260);
  if (below) a.tween({ y: s.h + s.size * 1.1 }, 200, easeIn);
  else a.cue({ pose: 'bit-running' }).move(toRight ? s.w + s.size : -s.size, RUN * 1.8);
  if (id !== 'wordthief' || !held || !s.letter) return { id, duration: a.duration, actor: a };
  // The dropped word falls back to where it was taken from, with a small bounce.
  const letter = new PropTrack(held, { actor: a, size: s.size }).fall(home(s.letter));
  return { id, duration: Math.max(a.duration, letter.duration), actor: a, letter };
}

export function pickSkit(ids: SkitId[], last: SkitId | null, rnd = Math.random): SkitId {
  const pool = ids.length > 1 && last ? ids.filter((i) => i !== last) : ids;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

