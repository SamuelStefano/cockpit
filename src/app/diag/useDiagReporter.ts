import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ConnState } from '../../components/primitives';
import { boxStore } from '../../cockpit/boxes-store';
import { sealState, type SealState } from '../../cockpit/sealed-socket';
import { wsBase } from '../../cockpit/session';
import { SUPABASE_ENABLED } from '../../lib/supabase';
import { recordConnEvent, relayAnsweredSinceDial } from '../connectionTelemetry';
import { connectionCause, selectedBox, type ConnCause } from './connectionCause';
import { scheduler, sendDiagReport, setDiagSnapshot } from './diagReport';

const TICK_MS = 5_000;
const SEAL_ERRORS: ReadonlySet<SealState> = new Set(['rejected', 'unsupported', 'enroll-failed']);

function hostOf(base: string): string {
  try { return new URL(base).host; } catch { return base; }
}

interface Input { conn: ConnState; authRejected: boolean; agentOnline: boolean; showOffline: boolean; offlineSince: number | null }

// Works out why the Deck is down (for the notice) and files the identified diag
// report while it stays down: after 20 s, then every 5 min, capped per hour.
export function useDiagReporter({ conn, authRejected, agentOnline, showOffline, offlineSince }: Input): { cause: ConnCause | null; box: ReturnType<typeof selectedBox> } {
  const boxes = useSyncExternalStore(boxStore.subscribe, boxStore.get);
  const seal = useSyncExternalStore(sealState.subscribe, sealState.get);
  const [, rerender] = useState(0);
  const box = selectedBox(boxes);
  const down = conn !== 'connected' || authRejected;
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const cause = down ? connectionCause({ authRejected, online, relayAnswered: relayAnsweredSinceDial(), agentOnline, box, seal }) : null;
  const incident = showOffline || authRejected ? cause : SEAL_ERRORS.has(seal) ? `seal-${seal}` : null;

  setDiagSnapshot({ cause, conn, seal, authRejected, agentOnline, offlineSince, wsHost: hostOf(wsBase()), box, boxes: boxes.frame?.boxes ?? [] });

  const incidentRef = useRef(incident);
  incidentRef.current = incident;
  const sinceRef = useRef(offlineSince);
  sinceRef.current = offlineSince;

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    const run = () => {
      const key = incidentRef.current;
      const d = scheduler.tick(key, Date.now(), key === 'login-refused');
      if (!d.send || !key) return;
      recordConnEvent('diag_report', { kind: key, repeat: d.repeat });
      void sendDiagReport(key, { auto: true, repeat: d.repeat, offlineMs: sinceRef.current ? Date.now() - sinceRef.current : null });
    };
    run();
    if (!incident) return;
    const id = setInterval(() => { rerender((n) => n + 1); run(); }, TICK_MS);
    return () => clearInterval(id);
  }, [incident]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    const report = (message: string, stack?: string) => {
      recordConnEvent('js_error', { message: message.slice(0, 200) });
      if (scheduler.once(`js:${message.slice(0, 120)}`, Date.now())) void sendDiagReport('js-error', { message: message.slice(0, 500), stack: stack?.slice(0, 4000) });
    };
    const onError = (e: ErrorEvent) => report(e.message || 'error', e.error instanceof Error ? e.error.stack : undefined);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);

  return { cause, box };
}
