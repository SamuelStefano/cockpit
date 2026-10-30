import { forwardRef, useRef } from 'react';
import { Button, SectionHeader } from '../../components/primitives';
import { useBitRunner } from '../../game/useBitRunner';

export const BitRunner = forwardRef<HTMLElement, { best: number }>(function BitRunner({ best }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { phase, score, press } = useBitRunner(canvas, best);
  return (
    <section ref={ref} className="scroll-mt-4">
      <SectionHeader
        title="Bit Runner" icon="play"
        description="Pule os bugs e conflitos de merge, pegue os ⚡. Espaço, seta para cima ou toque."
        actions={<Button size="sm" variant="secondary" onClick={press}>{phase === 'running' ? 'Pular' : phase === 'over' ? 'Jogar de novo' : 'Começar'}</Button>}
      />
      <canvas
        ref={canvas}
        onPointerDown={(e) => { e.preventDefault(); press(); }}
        aria-label={`Bit Runner, ${score} pontos, recorde ${best}`}
        role="img"
        className="block aspect-[16/5] w-full touch-none select-none rounded-xl border border-neutral-800 bg-neutral-950"
      />
    </section>
  );
});
