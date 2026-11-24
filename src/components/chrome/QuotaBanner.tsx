import { Icon, Tooltip, tokens } from '../primitives';

// Desktop quota warning: only the reset time, in a corner of the chat footer. The usage number
// itself stays in the header ring, so the two never disagree; on mobile the ring carries it all.
export function QuotaBanner({ onClose, reset }: { onClose: () => void; reset: string }) {
  return (
    <span role="status" className="group flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap pl-1.5 text-[12px] text-neutral-500">
      <Tooltip label="Uso do plano perto do limite" side="top">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span>Limite reseta em <span className="tabular-nums text-neutral-400">{reset}</span></span>
        </span>
      </Tooltip>
      <button
        onClick={onClose}
        title="Dispensar"
        aria-label="Dispensar aviso de uso"
        className={`shrink-0 rounded-sm p-0.5 text-neutral-600 opacity-0 transition hover:bg-neutral-800 hover:text-neutral-200 focus-visible:opacity-100 group-hover:opacity-100 ${tokens.touchTarget}`}
      >
        <Icon name="x" size={11} />
      </button>
    </span>
  );
}
