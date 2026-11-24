export type EggTrigger = 'konami' | 'iddqd' | 'matrix';

type Listener = (id: EggTrigger) => void;

const listeners = new Set<Listener>();

// Hidden palette commands fire the same effects as the typed codes.
export function triggerEgg(id: EggTrigger): void {
  for (const l of listeners) l(id);
}

export function subscribeEggTrigger(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
