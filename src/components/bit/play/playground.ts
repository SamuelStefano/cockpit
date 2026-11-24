import { ActorTrack, PropTrack, Track, easeOut, type ActorFrame, type PropFrame } from './track';

export type PlayAct = 'stroll' | 'look' | 'hop' | 'wave' | 'kick' | 'juggle' | 'greet';

export interface PlayWorld { w: number; floor: number; size: number; ball: number }

export interface PlayScene { act: PlayAct; actor: ActorTrack; ball: Track<PropFrame>; ballX: number }

export const STROLL = 70;
export const BALL_SIZE = 22;

const ballRest = (x: number, floor: number): PropFrame => ({ x, y: floor - BALL_SIZE / 2, rot: 0, s: 1, o: 1 });
const clampX = (x: number, w: PlayWorld) => Math.min(w.w - w.size * 0.6, Math.max(w.size * 0.6, x));

// Weighted so most of the time Bit just potters about; tricks are the seasoning.
const WEIGHTS: [PlayAct, number][] = [['stroll', 4], ['look', 3], ['hop', 1.5], ['wave', 1.2], ['kick', 1.6], ['juggle', 1.2]];

export function chooseAct(prev: PlayAct | null, rnd = Math.random): PlayAct {
  const pool = WEIGHTS.filter(([a]) => a !== prev);
  const total = pool.reduce((n, [, w]) => n + w, 0);
  let r = rnd() * total;
  for (const [a, w] of pool) { r -= w; if (r <= 0) return a; }
  return pool[pool.length - 1][0];
}

// One short scene from where Bit stands now; the hook samples it every frame and
// asks for the next one when it ends, or replaces it when the cursor comes close.
export function buildScene(act: PlayAct, from: ActorFrame, w: PlayWorld, rnd = Math.random, faceTo?: number): PlayScene {
  const a = new ActorTrack({ ...from, rot: 0, sx: 1, sy: 1 });
  let ball = new Track(ballRest(w.ball, w.floor));
  let ballX = w.ball;
  switch (act) {
    case 'stroll': {
      let to = clampX(w.size + rnd() * (w.w - 2 * w.size), w);
      if (Math.abs(to - from.x) < 60) to = clampX(from.x + (from.x > w.w / 2 ? -120 : 120), w);
      a.cue({ face: 'idle', pose: 'bit-walking bit-stroll' }).move(to, STROLL).cue({ pose: '' }).hold(500);
      break;
    }
    case 'look': {
      if (faceTo !== undefined && Math.sign(faceTo - from.x) !== from.flip) a.face(faceTo > from.x ? 1 : -1);
      a.cue({ face: 'idle', pose: '' }).hold(1600 + rnd() * 1400);
      break;
    }
    case 'hop':
      a.cue({ face: 'happy', pose: '' }).hop(18, 560).hold(120).hop(12, 460).cue({ face: 'idle' }).hold(400);
      break;
    case 'wave':
      a.cue({ face: 'wave', pose: '' }).hold(1900).cue({ face: 'idle' }).hold(300);
      break;
    case 'greet':
      a.cue({ face: 'surprised', pose: '' }).hold(240).cue({ face: 'happy' }).hop(22, 560).cue({ face: 'wave' }).hold(1100).cue({ face: 'idle' }).hold(200);
      break;
    case 'kick': {
      const dir: 1 | -1 = w.ball > w.w / 2 ? -1 : 1;
      const standX = w.ball - dir * (w.size * 0.42 + BALL_SIZE / 2);
      a.cue({ face: 'idle', pose: 'bit-walking bit-stroll' }).move(standX, STROLL * 1.3).face(dir)
        .cue({ face: 'sneaky', pose: '' }).tween({ sx: 1.1, sy: 0.88, rot: -dir * 6 }, 260, easeOut);
      const kickAt = a.duration;
      a.cue({ face: 'happy' }).tween({ sx: 0.95, sy: 1.06, rot: dir * 8 }, 120, easeOut).tween({ sx: 1, sy: 1, rot: 0 }, 260).hold(300)
        .cue({ face: 'idle', pose: 'bit-walking bit-stroll' });
      const land = clampX(w.ball + dir * (120 + rnd() * 140), w);
      const b = new Track(ballRest(w.ball, w.floor)).holdUntil(kickAt);
      const r0 = ballRest(w.ball, w.floor);
      const dx = land - w.ball;
      const hops = [{ f: 0.55, h: 46, ms: 620 }, { f: 0.3, h: 16, ms: 360 }, { f: 0.15, h: 0, ms: 420 }];
      let x = w.ball;
      for (const hp of hops) {
        const x0 = x;
        const x1 = x + dx * hp.f;
        b.add(hp.ms, (u) => ({ ...r0, x: x0 + (x1 - x0) * (hp.h ? u : easeOut(u)), y: r0.y - hp.h * 4 * u * (1 - u), rot: ((x0 + (x1 - x0) * u - w.ball) / (BALL_SIZE / 2)) * (180 / Math.PI) }));
        x = x1;
      }
      ball = b;
      a.move(clampX(land - dir * w.size * 0.9, w), STROLL).cue({ face: 'happy', pose: '' }).hop(10, 420);
      ballX = land;
      break;
    }
    case 'juggle': {
      const standX = clampX(w.ball, w);
      const dir: 1 | -1 = standX >= from.x ? 1 : -1;
      a.cue({ face: 'idle', pose: 'bit-walking bit-stroll' }).move(standX - dir * w.size * 0.5, STROLL * 1.3)
        .cue({ pose: 'bit-reach' }).tween({ sx: 1.08, sy: 0.9 }, 200, easeOut).tween({ sx: 1, sy: 1 }, 200);
      const grab = a.duration - 200;
      a.cue({ face: 'happy', pose: 'bit-juggle' }).hold(2400).cue({ face: 'idle', pose: 'bit-reach' }).hold(520).cue({ pose: '' }).hold(300);
      const p = new PropTrack(ballRest(w.ball, w.floor), { actor: a, size: w.size }).holdUntil(grab).lift(360, 10)
        .toss(560, 60, 1).toss(560, 60, -1).toss(700, 90, 2).carry(grab + 360 + 1820 + 260)
        .place(ballRest(w.ball, w.floor), 400).holdUntil(a.duration);
      ball = p;
      break;
    }
  }
  return { act, actor: a, ball, ballX };
}
