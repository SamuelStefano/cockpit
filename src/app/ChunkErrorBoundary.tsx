import { Component, type ReactNode } from 'react';
import { Button } from '../components/primitives';

// A lazy chunk that fails to load (flaky mobile network, or a tab older than the
// deploy that removed its chunks) rejects into React, and without a boundary the
// whole tree unmounts: a white screen, and the installed PWA has no reload button.
export class ChunkErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="m-4 flex flex-col items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <p className="text-[13px] text-neutral-200">Não consegui carregar esta parte do Deck.</p>
        <p className="text-[12px] text-neutral-500">A conexão caiu ou saiu uma versão nova. Recarregar resolve.</p>
        <Button size="sm" icon="rotate" onClick={() => location.reload()}>Recarregar</Button>
      </div>
    );
  }
}

const RELOAD_KEY = 'cockpit:preload-reload-at';

// Vite fires this when a dynamic import's chunk is gone (usually a new deploy).
// Reload once to pick up the new manifest; a second failure within a minute is
// left to the boundary instead of looping.
export function reloadOnStaleChunk(now = Date.now(), storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage, reload = () => location.reload()): boolean {
  const last = Number(storage.getItem(RELOAD_KEY) ?? 0);
  if (now - last < 60_000) return false;
  storage.setItem(RELOAD_KEY, String(now));
  reload();
  return true;
}
