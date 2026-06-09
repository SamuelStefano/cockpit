import { Icon } from '../primitives';

export function QueuedBanner({ queued, onCancelQueue }: { queued: string; onCancelQueue: () => void }) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] px-2.5 py-1.5">
      <Icon name="clock" size={12} className="mt-0.5 shrink-0 text-orange-400/80" />
      <span className="flex-1 text-[11.5px] leading-snug text-neutral-300">
        <span className="font-medium text-orange-300/90">na fila</span> · {queued}
      </span>
      <button
        onClick={onCancelQueue}
        title="Cancelar mensagem na fila"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
