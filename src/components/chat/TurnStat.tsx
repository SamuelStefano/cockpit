import type { TurnStats } from '../../../shared/protocol';
import { turnStatParts } from './toolbar-format';

// Custo/duração REAIS do último turno (result.total_cost_usd do CLI), não a
// estimativa por preço de token. Texto puro: vive dentro do menu "…" do cabeçalho.
export function TurnStat({ stats }: { stats?: TurnStats }) {
  const fmt = turnStatParts(stats);
  if (!fmt) return null;
  const { parts, model } = fmt;
  const turns = stats?.numTurns ? ` · ${stats.numTurns} turno${stats.numTurns === 1 ? '' : 's'}` : '';
  return (
    <p title="Último turno (custo real do CLI)" className="px-3 py-1.5 text-[12px] tabular-nums text-neutral-400">
      Último turno: {parts.join(' · ')}{model ? ` · ${model}` : ''}{turns}
    </p>
  );
}
