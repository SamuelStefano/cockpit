import { Button, Tooltip, UsageRing } from '../primitives';
import { contextMeter } from './toolbar-format';

// Always rendered so the top-right never shifts: dimmed while the window is
// roomy, "nova sessão" stays at hand and turns red near the limit.
export function ContextRing({ tokens, model, onNew }: { tokens: number; model?: string | null; onNew?: () => void }) {
  const m = contextMeter(tokens, model);
  const pct = m?.pct ?? 0;
  const label = m ? `Contexto da conversa: ${m.pct}% · ${m.k}k` : 'Contexto da conversa: 0%';
  const quiet = pct < 70;
  return (
    <div className="flex items-center gap-2">
      <Tooltip label={label} side="bottom">
        <span tabIndex={0} className={`inline-flex rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${quiet ? 'opacity-50' : ''}`}>
          <UsageRing value={pct} size={18} tone={m?.high ? 'high' : m?.mid ? 'mid' : 'idle'} label={label} />
        </span>
      </Tooltip>
      {onNew && (
        <Button
          variant={m?.high ? 'danger' : 'ghost'} size="xs" icon="plus" onClick={onNew}
          title={m?.high ? 'Contexto quase cheio — comece uma sessão nova para respostas mais rápidas e baratas' : 'Nova sessão'}
        >
          nova sessão
        </Button>
      )}
    </div>
  );
}
