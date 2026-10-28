import { Icon } from '../primitives';

// Neutral notice while the agent restarts for an update it announced; the red
// OfflineNotice takes over only if it does not come back in time.
export function RestartNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-2.5 z-40 w-[min(92vw,22rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-orange-500/30 bg-orange-500/12 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-md">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">
          <Icon name="rotate" size={13} />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-tight text-orange-100">
          Atualizando o Deck…
          <span className="block text-[12px] text-orange-200/70">Volta sozinho em instantes.</span>
        </p>
      </div>
    </div>
  );
}
