import { Bit } from '../components/bit/Bit';
import type { BitState } from '../components/bit/bit-state';
import { Button } from '../components/primitives';

export function AgentsHeader({ state, onAdd }: { state: BitState; onAdd: () => void }) {
  return (
    <section className="flex flex-wrap items-center gap-3">
      <Bit state={state} size={44} />
      <p className="min-w-0 flex-1 basis-56 text-[13px] leading-relaxed text-neutral-300">
        Ligue outros agentes de IA ao Deck. Escolha um e siga os 3 passos — eu rodo no terminal e testo.
      </p>
      <Button variant="secondary" size="md" icon="plus" onClick={onAdd}>Outro agente ACP</Button>
    </section>
  );
}
