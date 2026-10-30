import type { SysStats } from '../../shared/protocol';
import { Badge } from '../components/primitives';

function gb(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

interface Props {
  working: number;
  waiting: number;
  bots: number;
  stats: SysStats | null;
}

export function SalaHud({ working, waiting, bots, stats }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={working > 0 ? 'orange' : 'neutral'} dot>{working} em campo</Badge>
      <Badge tone={waiting > 0 ? 'yellow' : 'neutral'}>{waiting} esperando você</Badge>
      <Badge tone="neutral">{bots} bots</Badge>
      {stats && <Badge tone="neutral">CPU {Math.round(stats.cpu)}% · RAM {gb(stats.mem.used)}/{gb(stats.mem.total)}</Badge>}
    </div>
  );
}
