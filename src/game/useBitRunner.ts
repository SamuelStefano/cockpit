import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { initRun, jump, stepRun, runScore, type RunState } from './runner-physics';
import { drawRun } from './runner-draw';
import { recordGameEvent } from './game-bus';
import { sfx } from './sfx';
import { isTypingTarget } from './eggs';

export type RunnerPhase = 'idle' | 'running' | 'over';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useBitRunner(canvasRef: RefObject<HTMLCanvasElement | null>, best: number) {
  const [phase, setPhase] = useState<RunnerPhase>('idle');
  const [score, setScore] = useState(0);
  const run = useRef<RunState>(initRun());
  const phaseRef = useRef<RunnerPhase>('idle');
  const bestRef = useRef(best);
  bestRef.current = best;

  const setPh = (p: RunnerPhase) => { phaseRef.current = p; setPhase(p); };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const c = canvas?.getContext('2d');
    if (!canvas || !c) return;
    const scale = canvas.width / 640;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const p = phaseRef.current;
    const hint = p === 'idle' ? 'Espaço ou toque para pular' : p === 'over' ? 'Fim de jogo — toque para tentar de novo' : '';
    drawRun(c, run.current, { reduced: reducedMotion(), best: Math.max(bestRef.current, runScore(run.current)), hint });
  }, [canvasRef]);

  const press = useCallback(() => {
    if (phaseRef.current !== 'running') {
      run.current = initRun();
      setScore(0);
      setPh('running');
    }
    const next = jump(run.current);
    if (next !== run.current) sfx.jump();
    run.current = next;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const css = canvas.clientWidth || 640;
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr * (200 / 640));
      draw();
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(canvas);

    let raf = 0;
    let last = 0;
    let lastShown = 0;
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? (ts - last) / 1000 : 0;
      last = ts;
      if (phaseRef.current === 'running') {
        const before = run.current;
        run.current = stepRun(run.current, dt);
        const sc = runScore(run.current);
        if (sc !== lastShown && sc % 5 === 0) { lastShown = sc; setScore(sc); }
        if (run.current.over && !before.over) {
          const final = runScore(run.current);
          setScore(final);
          setPh('over');
          sfx.gameOver();
          recordGameEvent({ type: 'game_score', score: final });
        }
      }
      draw();
    };
    const start = () => { last = 0; raf = requestAnimationFrame(frame); };
    const onVis = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) start();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== 'Space' && e.key !== 'ArrowUp') || e.repeat || isTypingTarget(e.target)) return;
      if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
      e.preventDefault();
      press();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKey);
    if (!document.hidden) start();
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
    };
  }, [canvasRef, draw, press]);

  return { phase, score, press };
}
