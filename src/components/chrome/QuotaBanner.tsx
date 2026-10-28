import { Icon, UsageRing, ringToneOf, tokens } from '../primitives';

// Desktop quota warning, a quiet corner of the body footer. It used to own a whole row above
// the panel; on mobile the usage ring in the top bar carries the warning instead.
export function QuotaBanner({ onClose, reset, pct = null }: { onClose: () => void; reset: string; pct?: number | null }) {
  const text = pct === null ? 'Uso perto do limite' : `Uso em ${pct}%`;
  return (
    <span role="status" className="group flex h-6 shrink-0 items-center gap-1.5 rounded-md pl-1.5 pr-0.5 text-[12px] text-amber-200/80">
      <UsageRing value={pct ?? 90} tone={pct === null ? 'mid' : ringToneOf(pct)} size={14} label={text} />
      <span className="truncate">{text}</span>
      <span className="text-neutral-600">·</span>
      <span className="truncate text-neutral-500">reseta em {reset}</span>
      <button
        onClick={onClose}
        title="Dispensar"
        aria-label="Dispensar aviso de uso"
        className={`shrink-0 rounded-sm p-0.5 text-neutral-500 opacity-0 transition hover:bg-neutral-800 hover:text-neutral-200 focus-visible:opacity-100 group-hover:opacity-100 ${tokens.touchTarget}`}
      >
        <Icon name="x" size={11} />
      </button>
    </span>
  );
}
