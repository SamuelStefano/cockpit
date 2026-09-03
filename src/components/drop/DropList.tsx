import { Button, Icon } from '../primitives';
import { relPast } from '../../../shared/format';
import { relReset } from '../../lib/time';
import { fmtDropBytes } from './drop-format';
import type { DropRef } from '../../../shared/protocol';

// Drops já na box. Mostra referência (nome/tamanho/idade/prazo) e remove — nunca
// abre o conteúdo: ler o arquivo é trabalho do agente, sem imprimir.
export function DropList({ items, onRemove }: { items: DropRef[]; onRemove: (slug: string) => void }) {
  if (!items.length) {
    return <p className="mt-3 text-[11.5px] text-neutral-600">Nenhum drop na box.</p>;
  }
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((d) => (
        <li key={d.slug} className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5">
          <Icon name="shield" size={13} className="shrink-0 text-neutral-600" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[11.5px] text-neutral-300" title={d.path}>{d.slug}</div>
            <div className="font-mono text-[10px] text-neutral-600">
              {fmtDropBytes(d.bytes)} · {relPast(d.mtime)}
              {d.expiresAt ? ` · expira em ${relReset(d.expiresAt)}` : ''}
            </div>
          </div>
          <Button variant="danger" size="sm" square icon="trash" title={`Remover ${d.slug}`} onClick={() => onRemove(d.slug)} />
        </li>
      ))}
    </ul>
  );
}
