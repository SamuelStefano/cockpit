import { useEffect, useRef, useState } from 'react';
import type { BitState } from '../bit-state';
import { buildScene, chooseAct, BALL_SIZE, type PlayScene, type PlayWorld } from './playground';
import { actorTransform, propTransform } from './useSkitStage';
import type { ActorFrame } from './track';

export const PLAY_BIT_SIZE = 80;
const NEAR_PX = 70;
const GREET_COOLDOWN_MS = 4000;

export interface PlayLook { face: BitState; pose: string }

// Endless calm play on the new-chat screen: one rAF loop samples the current scene,
// writes transforms and the gaze straight to the DOM, and only re-renders React
// when the face or pose changes. Stops while the tab is hidden.
export function usePlayground(active: boolean) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const actorRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const [look, setLook] = useState<PlayLook>({ face: 'wave', pose: '' });

  useEffect(() => {
    const stage = stageRef.current;
    if (!active || !stage) return;
    const size = PLAY_BIT_SIZE;
    let w = stage.clientWidth;
    const h = stage.clientHeight;
    const world: PlayWorld = { w, floor: h - 6, size, ball: w * 0.72 };
    let frame: ActorFrame = { x: w / 2, y: world.floor, rot: 0, sx: 1, sy: 1, flip: 1 };
    let scene: PlayScene = buildScene('wave', frame, world);
    let t0 = performance.now();
    let cue = 0;
    let raf = 0;
    let lastGreet = performance.now();
    let mouse: { x: number; y: number } | null = null;
    let face: PlayLook = { face: 'wave', pose: '' };

    const start = (next: PlayScene, now: number) => { scene = next; world.ball = next.ballX; t0 = now; cue = 0; };
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onResize = () => { w = stage.clientWidth; world.w = w; };

    const tick = (now: number) => {
      let t = now - t0;
      if (t >= scene.actor.duration) {
        frame = scene.actor.sample(scene.actor.duration);
        start(buildScene(chooseAct(scene.act), frame, { ...world }, Math.random, mouse?.x), now);
        t = 0;
      }
      frame = scene.actor.sample(t);
      if (mouse && scene.act !== 'greet' && now - lastGreet > GREET_COOLDOWN_MS && Math.hypot(mouse.x - frame.x, mouse.y - (frame.y - size / 2)) < NEAR_PX) {
        lastGreet = now;
        world.ball = scene.ball.sample(t).x;
        start(buildScene('greet', frame, { ...world }), now);
        t = 0;
      }
      const cues = scene.actor.cues;
      let changed = false;
      while (cue < cues.length && cues[cue].at <= t) {
        const c = cues[cue++];
        if (c.face && c.face !== face.face) { face = { ...face, face: c.face }; changed = true; }
        if (c.pose !== undefined && c.pose !== face.pose) { face = { ...face, pose: c.pose }; changed = true; }
      }
      if (changed) setLook(face);
      const a = actorRef.current;
      if (a) {
        a.style.transform = actorTransform(frame, size);
        const head = { x: frame.x, y: frame.y - size * 0.55 };
        const gx = mouse ? Math.max(-4, Math.min(4, (mouse.x - head.x) / 40)) * frame.flip : 0;
        const gy = mouse ? Math.max(-3, Math.min(3, (mouse.y - head.y) / 40)) : 0;
        a.style.setProperty('--bit-gx', `${gx.toFixed(2)}px`);
        a.style.setProperty('--bit-gy', `${gy.toFixed(2)}px`);
      }
      const b = ballRef.current;
      if (b) b.style.transform = propTransform(scene.ball.sample(t), BALL_SIZE, BALL_SIZE);
      raf = requestAnimationFrame(tick);
    };

    let hiddenAt = 0;
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) { hiddenAt = performance.now(); return; }
      t0 += performance.now() - hiddenAt;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active]);

  return { stageRef, actorRef, ballRef, look };
}
