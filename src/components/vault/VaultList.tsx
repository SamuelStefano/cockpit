import { Button, Icon } from '../primitives';
import { relPast } from '../../../shared/format';
import { fmtDropBytes } from '../drop/drop-format';
import type { VaultItem } from '../../../shared/protocol';

export function VaultList({ items, onRemove }: { items: VaultItem[]; onRemove: (name: string) => void }) {
  if (!items.length) {
    return <p className="mt-3 text-[12px] text-neutral-600">Cofre vazio.</p>;
  }
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((s) => (
        <li key={s.name} className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5">
          <Icon name="shield" size={13} className="shrink-0 text-neutral-600" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[12px] text-neutral-300">{s.name}</div>
            <div className="truncate font-mono text-[12px] text-neutral-600">
              {fmtDropBytes(s.bytes)} · {relPast(s.updatedAt)} · {s.agents.length ? s.agents.join(', ') : 'nenhum agente'}
            </div>
          </div>
          <Button variant="danger" size="sm" square icon="trash" title={`Remover ${s.name}`} onClick={() => onRemove(s.name)} />
        </li>
      ))}
    </ul>
  );
}
