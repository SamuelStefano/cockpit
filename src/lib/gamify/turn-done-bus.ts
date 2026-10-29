type Listener = () => void;

const listeners = new Set<Listener>();

// Emitted by the chat when a turn ends without failing. The tally, haptics and
// confetti live elsewhere and only listen.
export function emitTurnDone(): void {
  for (const l of listeners) l();
}

export function subscribeTurnDone(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
