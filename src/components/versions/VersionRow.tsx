import { Badge, Button } from '../primitives';
import type { VersionMeta } from '../../../shared/versions';

const fmt = (ts: number) => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

interface Props {
  v: VersionMeta;
  current: boolean;
  selected: boolean;
  busy: boolean;
  onDiff: () => void;
  onRestore?: () => void;
}

export function VersionRow({ v, current, selected, busy, onDiff, onRestore }: Props) {
  return (
    <li className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${selected ? 'border-orange-500/40 bg-orange-500/5' : 'border-neutral-800'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-neutral-200">
          <span>{fmt(v.ts)}</span>
          {current && <Badge tone="neutral">atual</Badge>}
          {v.deleted && <Badge tone="neutral">removido</Badge>}
        </div>
        <div className="truncate text-[12px] text-neutral-500">{v.note ?? `${v.bytes} bytes`}</div>
      </div>
      {!current && <Button variant="ghost" size="sm" onClick={onDiff}>Comparar com atual</Button>}
      {!current && !v.deleted && onRestore && <Button variant="secondary" size="sm" icon="rotate" loading={busy} onClick={onRestore}>Restaurar</Button>}
    </li>
  );
}
