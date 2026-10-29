import { IconButton, Tooltip, UsageRing } from '../primitives';
import { contextMeter } from './toolbar-format';

// The ring is always rendered so the top-right never shifts: dimmed while the window
// is roomy. From 70 % an icon-only "restart with a clean context" appears (red near the limit).
export function ContextRing({ tokens, model, onNew }: { tokens: number; model?: string | null; onNew?: () => void }) {
  const m = contextMeter(tokens, model);
  const pct = m?.pct ?? 0;
  const label = m ? `Contexto da conversa: ${m.pct}% · ${m.k}k` : 'Contexto da conversa: 0%';
  const quiet = pct < 70;
  // Empty chat: keep the slot (nothing shifts) but do not draw a dimmed, disabled-looking ring.
  if (tokens === 0) return <span aria-hidden className="inline-block size-[18px]" />;
  return (
    <div className="flex items-center gap-2">
      <Tooltip label={label} side="bottom">
        <span tabIndex={0} className={`inline-flex rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${quiet ? 'opacity-50' : ''}`}>
          <UsageRing value={pct} size={18} tone={m?.high ? 'high' : m?.mid ? 'mid' : 'idle'} label={label} />
        </span>
      </Tooltip>
      {onNew && !quiet && (
        <IconButton
          icon="rotate" label="Recomeçar com contexto limpo" side="bottom" onClick={onNew}
          className={m?.high ? 'text-red-400 hover:text-red-300' : ''}
        />
      )}
    </div>
  );
}
