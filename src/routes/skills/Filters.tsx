import { Icon } from '../../components/primitives';
import type { RiskFilter, SourceFilter } from '../../lib/skill-view';

interface Props {
  chips: { id: SourceFilter; label: string }[];
  source: SourceFilter;
  risk: RiskFilter;
  onSource: (s: SourceFilter) => void;
  onRisk: (r: RiskFilter) => void;
}

const base = 'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[12px] transition';
const cls = (on: boolean) => `${base} ${on ? 'border-neutral-500 bg-neutral-800 text-neutral-100' : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'}`;

export function Filters({ chips, source, risk, onSource, onRisk }: Props) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtros">
      {chips.map((c) => (
        <button key={c.id} type="button" aria-pressed={source === c.id} className={cls(source === c.id)} onClick={() => onSource(c.id)}>{c.label}</button>
      ))}
      <button type="button" aria-pressed={risk === 'read'} className={cls(risk === 'read')} onClick={() => onRisk(risk === 'read' ? 'any' : 'read')}>
        <Icon name="search" size={11} />só lê
      </button>
      <button type="button" aria-pressed={risk === 'write'} className={cls(risk === 'write')} onClick={() => onRisk(risk === 'write' ? 'any' : 'write')}>
        <Icon name="pencil" size={11} />escreve
      </button>
    </div>
  );
}
