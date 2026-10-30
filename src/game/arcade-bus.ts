export type ArcadeRequest = 'popover' | 'runner';

type Listener = () => void;

const listeners: Record<ArcadeRequest, Set<Listener>> = { popover: new Set(), runner: new Set() };
const pending: Record<ArcadeRequest, boolean> = { popover: false, runner: false };

// The popover lives in the sidebar footer, which on a phone is only mounted while the
// drawer is open: a request with no listener waits and is delivered on subscribe.
export function requestArcade(kind: ArcadeRequest): void {
  if (listeners[kind].size === 0) { pending[kind] = true; return; }
  for (const l of listeners[kind]) l();
}

export function subscribeArcade(kind: ArcadeRequest, fn: Listener): () => void {
  listeners[kind].add(fn);
  if (pending[kind]) { pending[kind] = false; queueMicrotask(fn); }
  return () => { listeners[kind].delete(fn); };
}
