import { useEffect, useRef } from 'react';
import type { ConnState } from '../components/primitives';
import { shouldReconnect } from './live-connection';

// Debounce curto: visibilitychange + online + pageshow disparam em rajada no
// wake-from-sleep; coalesce num único reconnect.
const DEBOUNCE_MS = 500;

// No mobile a aba suspende (iOS/Android): o WS morre em silêncio e ao voltar o app
// fica com estado velho até um F5. Este hook reconecta/reconcilia quando a aba fica
// visível, a rede volta, ou o bfcache restaura a página.
export function useLiveConnection({ wsState, reconnectNow }: { wsState: ConnState; reconnectNow: () => void }) {
  // Refs pro estado atual sem re-registrar os listeners a cada render.
  const wsStateRef = useRef(wsState);
  wsStateRef.current = wsState;
  const reconnectRef = useRef(reconnectNow);
  reconnectRef.current = reconnectNow;
  const hiddenSince = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; reconnectRef.current(); }, DEBOUNCE_MS);
    };
    const evaluate = () => {
      const hiddenMs = hiddenSince.current == null ? 0 : Date.now() - hiddenSince.current;
      if (shouldReconnect(hiddenMs, wsStateRef.current)) schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') { hiddenSince.current = Date.now(); return; }
      evaluate();
      hiddenSince.current = null;
    };
    const onOnline = () => evaluate();
    // bfcache restore: o socket está morto mesmo que o wsState diga "connected" —
    // força o reconnect em vez de confiar no shouldReconnect.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) schedule(); else evaluate(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
}
