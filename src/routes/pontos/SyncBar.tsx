import type { DflPointsSnapshot } from '../../../shared/protocol';
import { Button, Icon } from '../../components/primitives';
import { relTime } from './format';

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
  return (
    <div className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[11.5px] ${
      stale ? 'border-yellow-500/30 bg-yellow-500/[0.06] text-yellow-300' : 'border-neutral-800 bg-neutral-900/40 text-neutral-500'}`}>
      {stale && <Icon name="clock" size={12} />}
      <span className="min-w-0 flex-1 truncate">
        {snapshot
          ? stale ? 'Dados possivelmente desatualizados — sincronize.' : `Sincronizado ${relTime(snapshot.syncedAt, now)}`
          : 'Sem snapshot local — sincronize pra puxar do DFL.'}
      </span>
      <Button variant={stale ? 'secondary' : 'ghost'} size="sm" loading={syncing} onClick={onSync}>
        <Icon name="rotate" size={13} /> {syncing ? 'sincronizando' : 'sincronizar agora'}
      </Button>
    </div>
  );
}
