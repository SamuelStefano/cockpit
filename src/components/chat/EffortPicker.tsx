import type { Effort } from '../../../shared/protocol';
import { EFFORT_LEVELS } from './effort-levels';

export function EffortPicker({ effort, setEffort }: {
  effort: Effort; setEffort: (e: Effort) => void;
}) {
  const sel = 'rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[11px] font-medium text-neutral-300 outline-hidden transition hover:border-neutral-700 focus:border-orange-500/40 sm:px-1.5 sm:py-1';
  const tag = 'hidden text-[9px] font-semibold uppercase tracking-wide text-neutral-600 sm:inline';
  return (
    <label className="inline-flex shrink-0 items-center gap-1" title="Nível de pensamento do próximo prompt — quanto maior, mais tokens (e custo).">
      <span className={tag}>pensar</span>
      <select
        value={effort}
        onChange={(e) => setEffort(e.target.value as Effort)}
        className={sel}
      >
        {EFFORT_LEVELS.map((l) => <option key={l.id} value={l.id} title={l.hint}>{l.label}</option>)}
      </select>
    </label>
  );
}
