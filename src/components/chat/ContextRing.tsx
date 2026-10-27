import { Button, Tooltip, UsageRing } from '../primitives';
import { contextMeter } from './toolbar-format';

// Context fill as a ring; the number lives in the tooltip. Near the limit the
// "nova sessão" action surfaces next to it instead of hiding in a menu.
export function ContextRing({ tokens, model, onNew }: { tokens: number; model?: string | null; onNew?: () => void }) {
  const m = contextMeter(tokens, model);
  if (!m) return null;
  const label = `Contexto ${m.pct}% · ${m.k}k`;
  return (
    <div className="flex items-center gap-2">
      <Tooltip label={label} side="bottom">
        <span tabIndex={0} className="inline-flex rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40">
          <UsageRing value={m.pct} size={20} tone={m.high ? 'high' : m.mid ? 'mid' : 'idle'} label={label} />
        </span>
      </Tooltip>
      {m.high && onNew && (
        <Button
          variant="danger" size="xs" icon="plus" onClick={onNew}
          title="Contexto quase cheio — comece uma sessão nova para respostas mais rápidas e baratas"
        >
          nova sessão
        </Button>
      )}
    </div>
  );
}
