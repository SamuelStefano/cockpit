export interface ConfettiOptions {
  count?: number;
  // Origem horizontal da chuva (0 = esquerda, 1 = direita). Default: largura toda.
  spread?: number;
}

type Listener = (opts: Required<ConfettiOptions>) => void;

const listeners = new Set<Listener>();

export function fireConfetti(opts: ConfettiOptions = {}): void {
  const full: Required<ConfettiOptions> = {
    count: opts.count ?? 90,
    spread: opts.spread ?? 1,
  };
  for (const l of listeners) l(full);
}

export function subscribeConfetti(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
