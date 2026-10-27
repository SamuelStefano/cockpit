import { Button, Modal } from '../primitives';
import { HealthBadge } from './HealthBadge';
import { HealthItemRow } from './HealthItemRow';
import { SmokeResultLine } from './SmokeResultLine';
import { useBoxHealthPanel } from './useBoxHealthPanel';

function fmtAt(at: number): string {
  return new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function BoxHealthPanel() {
  const p = useBoxHealthPanel();
  if (!p.open) return null;
  return (
    <Modal open onClose={p.close} title={`Saúde da máquina · ${p.name}`} icon="shield" maxWidth="max-w-lg">
      <div className="space-y-3">
        {!p.health && (!p.sealed || !p.online) ? (
          <p className="text-[12.5px] leading-relaxed text-neutral-400">
            {p.online ? 'Abrindo o canal cifrado com a máquina…' : 'A máquina está offline. Na máquina: '}
            {!p.online && <code className="rounded bg-neutral-800 px-1 font-mono text-[11.5px] text-neutral-200">systemctl status deck-agent --no-pager</code>}
          </p>
        ) : !p.health ? (
          <p className="text-[12.5px] text-neutral-400">Checando a máquina…</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <HealthBadge level={p.level} />
              <span className="text-[11.5px] text-neutral-500">checado às {fmtAt(p.health.at)}</span>
            </div>
            <ul className="divide-y divide-neutral-800/70">
              {p.health.items.map((i) => <HealthItemRow key={i.id} item={i} />)}
            </ul>
          </>
        )}
        <SmokeResultLine smoke={p.smoke} />
        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-800 pt-3">
          <Button variant="ghost" size="sm" icon="rotate" disabled={!p.sealed} onClick={p.refresh}>Verificar de novo</Button>
          <Button size="sm" icon="play" disabled={!p.sealed || p.testing} loading={p.testing} onClick={p.test}>Testar máquina</Button>
        </div>
      </div>
    </Modal>
  );
}
