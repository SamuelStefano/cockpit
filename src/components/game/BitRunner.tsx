import { useRef } from 'react';
import { Button, SectionHeader } from '../primitives';
import { useBitRunner } from '../../game/useBitRunner';

export function BitRunner({ best }: { best: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { phase, score, press } = useBitRunner(canvas, best);
  return (
    <section>
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
}
