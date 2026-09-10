import { Icon, tokens } from '../primitives';
import type { Session } from '../../data/types';
import { idleLabel } from './stale';

// Linha da lista do funil: a linha inteira é o checkbox. Desmarcada fica
// apagada, pra bater o olho e ver o que sai e o que fica.
export function FunnelRow({ s, checked, now, disabled, onToggle }: { s: Session; checked: boolean; now: number; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={`flex w-full items-center gap-2 border-b border-neutral-900 px-3 py-1.5 text-left transition last:border-b-0 hover:bg-neutral-900/70 disabled:opacity-50 ${tokens.focusRing} ${checked ? '' : 'opacity-50'}`}
    >
      <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition ${checked ? 'border-orange-500/70 bg-orange-500/80 text-neutral-950' : 'border-neutral-700 bg-neutral-950'}`}>
        {checked && <Icon name="check" size={10} />}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[12.5px] ${checked ? 'text-neutral-300' : 'text-neutral-500 line-through'}`}>{s.title}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">{idleLabel(s.mtime, now)}</span>
    </button>
  );
}
