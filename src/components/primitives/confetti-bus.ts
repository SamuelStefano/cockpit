export interface ConfettiOptions {
  count?: number;
  // Origem horizontal da chuva (0 = esquerda, 1 = direita). Default: largura toda.
  spread?: number;
  // Horizontal centre of the burst, 0..1 of the viewport width.
  originX?: number;
}

type Listener = (opts: Required<ConfettiOptions>) => void;

const listeners = new Set<Listener>();

export function fireConfetti(opts: ConfettiOptions = {}): void {
  const full: Required<ConfettiOptions> = {
    count: opts.count ?? 90,
    spread: opts.spread ?? 1,
    originX: opts.originX ?? 0.5,
  };
  for (const l of listeners) l(full);
}

export function subscribeConfetti(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
