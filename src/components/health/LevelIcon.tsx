import { Icon, type IconName } from '../primitives';
import type { StepState } from '../../cockpit/setup-watch';

const LOOK: Record<StepState, { name: IconName; cls: string; label: string }> = {
  ok: { name: 'check', cls: 'text-green-400', label: 'ok' },
  warn: { name: 'alertTriangle', cls: 'text-yellow-400', label: 'atenção' },
  error: { name: 'x', cls: 'text-red-400', label: 'erro' },
  active: { name: 'rotate', cls: 'spin text-orange-400', label: 'em andamento' },
  pending: { name: 'circle', cls: 'text-neutral-600', label: 'pendente' },
};

export function LevelIcon({ state, size = 13 }: { state: StepState; size?: number }) {
  const l = LOOK[state];
  return (
    <span role="img" aria-label={l.label} className="mt-px inline-flex shrink-0">
      <Icon name={l.name} size={size} className={l.cls} />
    </span>
  );
}
