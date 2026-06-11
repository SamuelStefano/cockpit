import { Icon } from '../primitives';
import type { TurnStats } from '../../../shared/protocol';
import { turnStatParts } from './toolbar.format';

// Custo/duração REAIS do último turno (result.total_cost_usd do CLI), não a
// estimativa por preço de token. Ground-truth — some quando há um valor.
export function TurnStat({ stats }: { stats?: TurnStats }) {
  const fmt = turnStatParts(stats);
  if (!fmt) return null;
  const { parts, model } = fmt;
  return (
    <span
      title={`último turno (custo real do CLI)${stats?.numTurns ? ` · ${stats.numTurns} turno${stats.numTurns === 1 ? '' : 's'}` : ''}${stats?.model ? ` · modelo efetivo: ${stats.model}` : ''}`}
      className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-[10.5px] tabular-nums text-neutral-400"
    >
      <Icon name="zap" size={10} className="text-emerald-400/70" />
      {parts.join(' · ')}
      {model && <span className="text-neutral-500">· {model}</span>}
    </span>
  );
}
