import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnState } from '../components/primitives';

export const RECONNECT_RESULT_MS = 8_000;
export type ReconnectStatus = 'idle' | 'trying' | 'failed';

// The "Reconectar agora" button: a forced fresh dial plus visible feedback. Before,
// the click redialed but the banner looked the same, so it read as broken.
export function useReconnectAction(reconnectNow: (opts?: { force?: boolean }) => void, conn: ConnState) {
  const [status, setStatus] = useState<ReconnectStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (conn !== 'connected') return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setStatus('idle');
  }, [conn]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const trigger = useCallback(() => {
    setStatus('trying');
    reconnectNow({ force: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; setStatus((s) => (s === 'trying' ? 'failed' : s)); }, RECONNECT_RESULT_MS);
  }, [reconnectNow]);

  return { status, trigger };
}
