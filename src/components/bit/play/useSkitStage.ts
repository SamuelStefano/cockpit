import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { BitState } from '../bit-state';
import { buildExit, buildSkit, type Skit, type SkitId, type Stage } from './skits';
import { findLetter, findWord, hideGlyph, type LetterPick } from './find-letter';
import type { ActorFrame, PropFrame } from './track';
import { sfx } from '../../../game/sfx';

export const STAGE_BIT_SIZE = 84;

export interface StageLook {
  face: BitState;
  pose: string;
  gaze: [number, number];
  prop: Skit['prop'];
  letter: Pick<LetterPick, 'char' | 'font'> & { w: number; h: number } | null;
}

const OFF: StageLook = { face: 'idle', pose: '', gaze: [0, 0], prop: undefined, letter: null };

export function actorTransform(f: ActorFrame, size: number): string {
  return `translate3d(${f.x - size / 2}px, ${f.y - size}px, 0) rotate(${f.rot}deg) scale(${f.flip * f.sx}, ${f.sy})`;
}

export function propTransform(p: PropFrame, w: number, h: number): string {
  return `translate3d(${p.x - w / 2}px, ${p.y - h / 2}px, 0) rotate(${p.rot}deg) scale(${p.s})`;
}

// Plays one skit at a time on an overlay layer with a single rAF loop that writes
// transforms straight to two nodes; React only re-renders on the few cue changes.
export function useSkitStage(layerRef: RefObject<HTMLElement | null>, textRootRef: RefObject<HTMLElement | null> | undefined, onEnd?: () => void) {
  const [look, setLook] = useState<StageLook | null>(null);
  const actorRef = useRef<HTMLDivElement | null>(null);
  const letterRef = useRef<HTMLSpanElement | null>(null);
  const run = useRef<{ skit: Skit; stage: Stage; t0: number; cue: number; sfxAt: number; raf: number; pick: LetterPick | null; unhide: (() => void) | null; leaving: boolean } | null>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  const stop = useCallback((notify: boolean) => {
    const r = run.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    r.unhide?.();
    run.current = null;
    setLook(null);
    if (notify) endRef.current?.();
  }, []);

  const tick = useCallback((now: number) => {
    const r = run.current;
    if (!r) return;
    const t = now - r.t0;
    const { skit, stage } = r;
    const cues = skit.actor.cues;
    let changed: Partial<StageLook> | null = null;
    while (r.cue < cues.length && cues[r.cue].at <= t) {
      const c = cues[r.cue++];
      const next: Partial<StageLook> = changed ?? {};
      if (c.face) next.face = c.face;
      if (c.pose !== undefined) next.pose = c.pose;
      if (c.gaze) next.gaze = c.gaze;
      changed = next;
    }
    const cuesSfx = skit.sfx;
    if (cuesSfx) while (r.sfxAt < cuesSfx.length && cuesSfx[r.sfxAt].at <= t) { sfx[cuesSfx[r.sfxAt].name](); r.sfxAt++; }
    if (changed) { const ch = changed; setLook((l) => (l ? { ...l, ...ch } : l)); }
    const a = actorRef.current;
    if (a) a.style.transform = actorTransform(skit.actor.sample(t), stage.size);
    const el = letterRef.current;
    if (el && skit.letter && r.pick) {
      const p = skit.letter.sample(t);
      el.style.transform = propTransform(p, r.pick.box.width, r.pick.box.height);
      const away = Math.abs(p.x - stage.letter!.x) + Math.abs(p.y - stage.letter!.y) > 0.5 || Math.abs(p.s - 1) > 0.01;
      if (away && !r.unhide) r.unhide = hideGlyph(r.pick.range);
      else if (!away && r.unhide) { r.unhide(); r.unhide = null; }
    }
    if (t >= skit.duration) { stop(true); return; }
    r.raf = requestAnimationFrame(tick);
  }, [stop]);

  const begin = useCallback((skit: Skit, stage: Stage, pick: LetterPick | null, leaving: boolean) => {
    const prev = run.current;
    if (prev) cancelAnimationFrame(prev.raf);
    if (!skit.letter) prev?.unhide?.();
    run.current = { skit, stage, t0: performance.now(), cue: 0, sfxAt: 0, raf: 0, pick, unhide: skit.letter ? prev?.unhide ?? null : null, leaving };
    setLook((l) => ({
      ...(l ?? OFF),
      prop: skit.prop,
      letter: pick && skit.letter ? { char: pick.char, font: pick.font, w: pick.box.width, h: pick.box.height } : null,
    }));
    run.current.raf = requestAnimationFrame(tick);
  }, [tick]);

  const play = useCallback((id: SkitId): boolean => {
    const layer = layerRef.current;
    if (!layer || run.current) return false;
    const { width: w, height: h } = layer.getBoundingClientRect();
    const size = STAGE_BIT_SIZE;
    if (w < size * 4 || h < size * 2) return false;
    let pick: LetterPick | null = null;
    if (id === 'thief') {
      pick = textRootRef?.current ? findLetter(textRootRef.current, layer, size) : null;
      if (!pick) id = 'peek';
    } else if (id === 'wordthief') {
      pick = textRootRef?.current ? findWord(textRootRef.current, layer, size) : null;
      if (!pick) return false;
    }
    const stage: Stage = { w, h, size, letter: pick ? { x: pick.box.left + pick.box.width / 2, y: pick.box.top + pick.box.height / 2, h: pick.box.height, w: pick.box.width } : undefined };
    begin(buildSkit(id, stage), stage, pick, false);
    return true;
  }, [begin, layerRef, textRootRef]);

  // Caught: swap the running script for a short exit that starts exactly where Bit is.
  const hurry = useCallback(() => {
    const r = run.current;
    if (!r || r.leaving) return;
    const t = performance.now() - r.t0;
    const exit = buildExit(r.skit.id, r.stage, r.skit.actor.sample(t), r.skit.letter?.sample(t));
    begin(exit, r.stage, r.pick, true);
  }, [begin]);

  const abort = useCallback(() => stop(false), [stop]);

  useEffect(() => () => stop(false), [stop]);

  return { look, actorRef, letterRef, play, hurry, abort, playing: look !== null };
}
