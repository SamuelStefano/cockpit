import { Icon, tokens } from '../primitives';

// Desktop quota warning, shown in the main column under the update notices. It used to be
// `absolute bottom-3 right-3` over the panel: with the phone keyboard open the
// viewport shrank and the pill landed on the last message. On mobile the usage
// ring in the top bar carries the warning instead.
export function QuotaBanner({ onClose, reset }: { onClose: () => void; reset: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-sm border border-yellow-500/25 bg-yellow-500/10 px-1.5 py-0.5 text-yellow-200/80">
      <Icon name="zap" size={11} className="shrink-0 text-yellow-400/80" />
      <span className="truncate font-mono text-[12px]">uso próximo do limite · reseta {reset}</span>
      <button
        onClick={onClose}
        title="Dispensar"
        aria-label="Dispensar aviso de uso"
        className={`shrink-0 rounded-sm p-0.5 text-yellow-200/50 transition hover:bg-yellow-500/10 hover:text-yellow-200 ${tokens.touchTarget}`}
      >
        <Icon name="x" size={11} />
      </button>
    </span>
  );
}
