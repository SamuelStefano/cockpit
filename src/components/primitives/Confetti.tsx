import { useEffect, useRef, useState } from 'react';
import { subscribeConfetti, type ConfettiOptions } from './confetti-bus';

const COLORS = ['#f97316', '#fb923c', '#22c55e', '#eab308', '#38bdf8', '#a78bfa', '#f5f5f5'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Piece {
  id: number;
  left: number;
  size: number;
  color: string;
  dx: number;
  rot: number;
  dur: number;
  delay: number;
  round: boolean;
}

interface Burst { id: number; pieces: Piece[] }

function makePieces(count: number, spread: number, seq: () => number): Piece[] {
  const mid = 50;
  const half = spread * 50;
  return Array.from({ length: count }, () => ({
    id: seq(),
    left: rand(mid - half, mid + half),
    size: rand(6, 11),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    dx: rand(-140, 140),
    rot: rand(360, 900) * (Math.random() < 0.5 ? -1 : 1),
    dur: rand(2.2, 3.4),
    delay: rand(0, 260),
    round: Math.random() < 0.4,
  }));
}

// Overlay único (montado uma vez no App): escuta o bus e dispara rajadas de
// confetti. pointer-events-none garante que nunca rouba clique. Respeita
// prefers-reduced-motion (não anima nada). Cada peça se limpa sozinha.
export function ConfettiHost() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return subscribeConfetti((opts: Required<ConfettiOptions>) => {
      if (reduce) return;
      const id = ++seq.current;
      const pieces = makePieces(opts.count, opts.spread, () => ++seq.current);
      setBursts((b) => [...b, { id, pieces }]);
      window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 3800);
    });
  }, []);

  if (!bursts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {bursts.map((burst) =>
        burst.pieces.map((p) => (
          <span
            key={`${burst.id}-${p.id}`}
            className={`confetti-pc ${p.round ? 'rounded-full' : 'rounded-[1px]'}`}
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * (p.round ? 1 : rand(0.5, 0.9)),
              background: p.color,
              ['--dx' as string]: `${p.dx}px`,
              ['--rot' as string]: `${p.rot}deg`,
              ['--dur' as string]: `${p.dur}s`,
              ['--delay' as string]: `${p.delay}ms`,
            }}
          />
        )),
      )}
    </div>
  );
}
