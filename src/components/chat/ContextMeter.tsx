import { Icon } from '../primitives';
import { contextMeter } from './toolbar-format';
import { contextWindowFor } from '../../lib/format';

// O medidor mostra quanto do contexto o último turno ocupou; perto do teto,
// sugere abrir nova sessão.
export function ContextMeter({ tokens, model, onNew }: { tokens: number; model?: string | null; onNew?: () => void }) {
  const m = contextMeter(tokens, model);
  if (!m) return null;
  const { pct, high, mid, k } = m;
  const color = high ? 'bg-red-500' : mid ? 'bg-amber-500' : 'bg-neutral-600';
  const text = high ? 'text-red-400' : mid ? 'text-amber-400' : 'text-neutral-500';
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1.5"
        title={`contexto: ~${tokens.toLocaleString('pt-BR')} tokens de ~${contextWindowFor(model).toLocaleString('pt-BR')} (${pct}%)`}
      >
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[11px] tabular-nums ${text}`}>{k}k</span>
      </div>
      {high && onNew && (
        <button
          onClick={onNew}
          title="Contexto quase cheio — comece uma sessão nova para respostas mais rápidas e baratas"
          // nowrap/shrink-0: in a crowded chat header the label broke onto two lines
          // inside its red border.
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-red-300 transition hover:bg-red-500/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500/40"
        >
          <Icon name="plus" size={11} /> nova sessão
        </button>
      )}
    </div>
  );
}
