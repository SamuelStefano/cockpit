import { useState, useEffect, useRef } from 'react';
import type { ConnState } from '../components/primitives';
import { clearAgentRestarting, restartAnnouncedRecently } from './restartNotice';
import { buildReport, endOfflineEpisode, getLastClose, reportContext, sendConnectionReport } from './connectionTelemetry';

export const OFFLINE_AFTER_MS = 6000;
export const RESTART_GRACE_MS = 45_000;

// Só alarma depois de ~6s offline (atravessa o flap reconnecting↔down sem piscar).
// Se o agente avisou que reinicia pra atualizar, mostra o aviso neutro por até 45s
// antes de cair no banner vermelho.
export function useOfflineLatch(connWs: ConnState, authRequired = false): { showOffline: boolean; restarting: boolean; offlineSince: number | null } {
  const offlineSince = useRef<number | null>(null);
  const planned = useRef(false);
  const [state, setState] = useState<'ok' | 'restarting' | 'offline'>('ok');
  const wentOffline = useRef(false);
  const connRef = useRef(connWs);
  connRef.current = connWs;
  useEffect(() => {
    if (connWs === 'connected') {
      if (wentOffline.current && offlineSince.current != null) sendConnectionReport(buildReport({ kind: 'ws_recovered', offlineMs: Date.now() - offlineSince.current, ...reportContext() }));
      wentOffline.current = false; endOfflineEpisode(); offlineSince.current = null; planned.current = false; clearAgentRestarting(); setState('ok'); return; }
    if (offlineSince.current == null) { offlineSince.current = Date.now(); planned.current = restartAnnouncedRecently(); }
    const wait = (planned.current ? RESTART_GRACE_MS : OFFLINE_AFTER_MS) - (Date.now() - offlineSince.current);
    if (planned.current) setState('restarting');
    const id = setTimeout(() => {
      setState('offline');
      wentOffline.current = true;
      const c = getLastClose();
      const phase = connRef.current === 'connected' ? undefined : connRef.current;
      sendConnectionReport(buildReport({ kind: 'ws_offline', closeCode: c?.code, closeReason: c?.reason, phase, offlineMs: Date.now() - (offlineSince.current ?? Date.now()), ...reportContext() }));
    }, Math.max(0, wait));
    return () => clearTimeout(id);
  }, [connWs]);
  useEffect(() => {
    if (!authRequired) return;
    const c = getLastClose();
    sendConnectionReport(buildReport({ kind: 'auth_rejected', closeCode: c?.code ?? 4401, closeReason: c?.reason, ...reportContext() }));
  }, [authRequired]);
  return { showOffline: state === 'offline', restarting: state === 'restarting', offlineSince: offlineSince.current };
}
