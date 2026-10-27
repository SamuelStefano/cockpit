import { Badge } from '../primitives';
import type { HealthLevel } from '../../../shared/box-health';

const TONE = { ok: 'green', warn: 'yellow', error: 'red' } as const;
const TEXT: Record<HealthLevel, string> = { ok: 'ok', warn: 'atenção', error: 'erro' };

export function HealthBadge({ level, onClick }: { level: HealthLevel | null; onClick?: () => void }) {
  if (!level) return null;
  return (
    <Badge tone={TONE[level]} dot onClick={onClick} title={`Saúde da máquina: ${TEXT[level]}`} className="shrink-0">
      {TEXT[level]}
    </Badge>
  );
}
