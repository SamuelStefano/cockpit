export interface PillInput {
  icon: string;
  title: string;
  confetti?: number;
}

type Listener = (pill: PillInput) => void;

const listeners = new Set<Listener>();

export function showPill(pill: PillInput): void {
  for (const l of listeners) l(pill);
}

export function subscribePills(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
