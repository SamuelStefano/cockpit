import type { DflPointsSnapshot } from '../../../shared/protocol';
import { Button, Icon } from '../../components/primitives';
import { relPast } from '../../../shared/format';

interface Props {
  snapshot: DflPointsSnapshot | null;
  syncing: boolean;
  now: number;
  onSync: () => void;
}

// Estado do sync + botão "sincronizar agora". Banner âmbar quando o snapshot está
// velho (server marcou stale): os números podem não refletir o DFL atual.
export function SyncBar({ snapshot, syncing, now, onSync }: Props) {
  const stale = snapshot?.stale ?? false;
  // O rótulo canônico é seco ("5min") porque em toda outra tela ele é um chip de canto;
  // aqui entra no meio de uma frase, então o "há" é da frase, não do formatador.
  const quando = snapshot ? relPast(snapshot.syncedAt, now) : '';
  return (
    <div className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[11.5px] ${
      stale ? 'border-yellow-500/30 bg-yellow-500/6 text-yellow-300' : 'border-neutral-800 bg-neutral-900/40 text-neutral-500'}`}>
      {stale && <Icon name="clock" size={12} />}
      <span className="min-w-0 flex-1 truncate">
        {snapshot
          ? stale ? 'Dados possivelmente desatualizados — sincronize.' : `Sincronizado ${quando === 'agora' ? 'agora' : `há ${quando}`}`
          : 'Sem snapshot local — sincronize pra puxar do DFL.'}
      </span>
      <Button variant={stale ? 'secondary' : 'ghost'} size="sm" icon="rotate" loading={syncing} onClick={onSync}>
        {syncing ? 'sincronizando' : 'sincronizar agora'}
      </Button>
    </div>
  );
}
