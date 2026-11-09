import type { Effort } from '../../../shared/protocol';
import { Icon, tokens } from '../primitives';
import { EFFORT_LEVELS } from './effort-levels';

const DEFAULT_EFFORT: Effort = 'low';

export function EffortColumn({ effort, setEffort }: { effort: Effort; setEffort: (e: Effort) => void }) {
  return (
    <div className="flex shrink-0 flex-col border-t border-neutral-800 p-1.5 sm:w-[170px] sm:border-l sm:border-t-0">
      <div className="px-2 pb-1 pt-1.5 text-[12px] font-medium text-neutral-400">Raciocínio</div>
      <div role="radiogroup" aria-label="Raciocínio" className="flex flex-wrap gap-1 sm:flex-col sm:gap-0">
        {EFFORT_LEVELS.map((l) => {
          const on = l.id === effort;
          return (
            <button key={l.id} type="button" role="radio" aria-checked={on} title={l.hint} onClick={() => setEffort(l.id)}
              className={`flex min-h-[38px] items-center gap-1.5 rounded-full border border-neutral-800 px-3 text-[13px] text-neutral-100 hover:bg-neutral-800/60 pointer-coarse:min-h-11 sm:w-full sm:rounded-lg sm:border-0 sm:px-2 sm:text-left ${on ? 'bg-neutral-800/50' : ''} ${tokens.focusRing}`}>
              <span className="min-w-0 flex-1 truncate">{l.label}</span>
              {l.id === DEFAULT_EFFORT && <span className="text-[11px] text-neutral-500">padrão</span>}
              {on && <Icon name="check" size={14} className="shrink-0 text-orange-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
