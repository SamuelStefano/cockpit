import { useRef } from 'react';
import { useMatrixRain } from './useMatrixRain';

// Click or Esc dismisses; it also ends by itself after 8s. Static under reduced motion.
export function MatrixRain({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useMatrixRain(ref, onDone, 8000);
  return <canvas ref={ref} aria-hidden onClick={onDone} className="fixed inset-0 z-80 h-full w-full cursor-pointer bg-black/80" />;
}
