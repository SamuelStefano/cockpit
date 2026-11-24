import type { Effort } from '../../../shared/protocol';
import { Icon, tokens } from '../primitives';
import { EFFORT_LEVELS } from './effort-levels';

const DEFAULT_EFFORT: Effort = 'low';

// Phone: one segmented strip of five equal cells (wrapping pills left "Máximo" alone on a second row).
// sm and up: a vertical column beside the model list.
const cell = 'flex min-h-11 flex-col items-center justify-center rounded-lg px-1 text-center text-[13px] leading-tight text-neutral-100 hover:bg-neutral-800/60 sm:min-h-[38px] sm:w-full sm:flex-row sm:gap-1.5 sm:px-2 sm:text-left';

export function EffortColumn({ effort, setEffort }: { effort: Effort; setEffort: (e: Effort) => void }) {
  return (
    <div className="flex shrink-0 flex-col border-t border-neutral-800 p-1.5 sm:w-[170px] sm:border-l sm:border-t-0">
      <div className="px-2 pb-1 pt-1.5 text-[12px] font-medium text-neutral-400">Raciocínio</div>
      <div role="radiogroup" aria-label="Raciocínio" className="grid grid-cols-5 gap-1 sm:flex sm:flex-col sm:gap-0">
        {EFFORT_LEVELS.map((l) => {
          const on = l.id === effort;
          return (
            <button key={l.id} type="button" role="radio" aria-checked={on} title={l.hint} onClick={() => setEffort(l.id)}
              className={`${cell} ${on ? 'bg-orange-500/12 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.35)] sm:bg-neutral-800/50 sm:shadow-none' : ''} ${tokens.focusRing}`}>
              <span className="min-w-0 sm:flex-1 sm:truncate">{l.label}</span>
              {l.id === DEFAULT_EFFORT && <span className="text-[10px] text-neutral-500 sm:text-[11px]">padrão</span>}
              {on && <Icon name="check" size={14} className="hidden shrink-0 text-orange-400 sm:block" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
