import { useState, useEffect, useRef } from 'react';
import type { ConnState } from '../components/primitives';
import { clearAgentRestarting, restartAnnouncedRecently } from './restartNotice';

export const OFFLINE_AFTER_MS = 6000;
export const RESTART_GRACE_MS = 45_000;

// Só alarma depois de ~6s offline (atravessa o flap reconnecting↔down sem piscar).
// Se o agente avisou que reinicia pra atualizar, mostra o aviso neutro por até 45s
// antes de cair no banner vermelho.
export function useOfflineLatch(connWs: ConnState): { showOffline: boolean; restarting: boolean } {
  const offlineSince = useRef<number | null>(null);
  const planned = useRef(false);
  const [state, setState] = useState<'ok' | 'restarting' | 'offline'>('ok');
  useEffect(() => {
    if (connWs === 'connected') { offlineSince.current = null; planned.current = false; clearAgentRestarting(); setState('ok'); return; }
    if (offlineSince.current == null) { offlineSince.current = Date.now(); planned.current = restartAnnouncedRecently(); }
    const wait = (planned.current ? RESTART_GRACE_MS : OFFLINE_AFTER_MS) - (Date.now() - offlineSince.current);
    if (planned.current) setState('restarting');
    const id = setTimeout(() => setState('offline'), Math.max(0, wait));
    return () => clearTimeout(id);
  }, [connWs]);
  return { showOffline: state === 'offline', restarting: state === 'restarting' };
}
