import { Icon } from '../primitives';

export function QuotaBanner({ onClose, reset }: { onClose: () => void; reset: string }) {
  return (
    <div className="fade-up pointer-events-none absolute bottom-3 right-3 z-30 max-w-[calc(100vw-1.5rem)]">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-yellow-500/20 bg-neutral-900/85 py-1 pl-2 pr-1 text-yellow-200/80 shadow-lg shadow-black/30 backdrop-blur-md transition hover:border-yellow-500/40 hover:text-yellow-200">
        <Icon name="zap" size={12} className="shrink-0 text-yellow-400/80" />
        <span className="truncate text-[11px]">Uso próximo do limite · reseta {reset}</span>
        <button onClick={onClose} title="Dispensar" className="shrink-0 rounded-full p-0.5 text-yellow-200/40 transition hover:bg-yellow-500/10 hover:text-yellow-200">
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>
  );
}
