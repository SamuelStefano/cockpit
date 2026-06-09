import { Icon } from '../primitives';

// Fila do cliente: mensagens digitadas durante um turno, disparadas em ordem
// quando a sessão libera. Cada item tem seu X (cancela só ele) — sem isto,
// enfileirar uma 2ª mensagem sobrescrevia/perdia a 1ª (perda silenciosa).
export function QueuedBanner({ queued, onCancelQueueAt }: { queued: string[]; onCancelQueueAt: (i: number) => void }) {
  return (
    <div className="mb-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] px-2.5 py-1.5">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-orange-300/90">
        <Icon name="clock" size={12} className="shrink-0 text-orange-400/80" />
        {queued.length === 1 ? 'na fila' : `${queued.length} na fila`}
      </div>
      <ul className="flex flex-col gap-1">
        {queued.map((text, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-orange-400/50">{i + 1}.</span>
            <span className="flex-1 truncate text-[11.5px] leading-snug text-neutral-300">{text}</span>
            <button
              onClick={() => onCancelQueueAt(i)}
              title="Cancelar esta mensagem na fila"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
            >
              <Icon name="x" size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
