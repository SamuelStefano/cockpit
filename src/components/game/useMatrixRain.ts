import { useEffect, type RefObject } from 'react';

const GLYPHS = 'アイウエオカキクケコサシスセソ0123456789ABCDEF<>/{}';
const FONT = 16;

export function useMatrixRain(ref: RefObject<HTMLCanvasElement | null>, onDone: () => void, ms: number): void {
  useEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext('2d');
    if (!canvas || !c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = Math.ceil(w / FONT);
    const drops = Array.from({ length: cols }, () => Math.random() * -40);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => {
      c.fillStyle = 'rgba(0, 0, 0, 0.09)';
      c.fillRect(0, 0, w, h);
      c.font = `${FONT}px ui-monospace, monospace`;
      for (let i = 0; i < cols; i++) {
        c.fillStyle = Math.random() < 0.05 ? '#ecfccb' : '#22c55e';
        c.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * FONT, drops[i] * FONT);
        if (drops[i] * FONT > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    };
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (ts - last < 45) return;
      last = ts;
      tick();
    };
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    if (reduced) for (let i = 0; i < 40; i++) { for (let j = 0; j < cols; j++) drops[j] += Math.random() * 0.8; tick(); }
    else raf = requestAnimationFrame(loop);
    const done = window.setTimeout(onDone, ms);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
      window.removeEventListener('keydown', onKey);
    };
  }, [ref, onDone, ms]);
}
