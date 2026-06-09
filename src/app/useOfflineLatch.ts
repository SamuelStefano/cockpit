import { useState, useEffect, useRef } from 'react';
import type { ConnState } from '../components/primitives';

// Só alarma depois de ~6s offline (atravessa o flap reconnecting↔down sem piscar).
export function useOfflineLatch(connWs: ConnState) {
  const offlineSince = useRef<number | null>(null);
  const [showOffline, setShowOffline] = useState(false);
  useEffect(() => {
    if (connWs === 'connected') { offlineSince.current = null; setShowOffline(false); return; }
    if (offlineSince.current == null) offlineSince.current = Date.now();
    const id = setTimeout(() => setShowOffline(true), Math.max(0, 6000 - (Date.now() - offlineSince.current)));
    return () => clearTimeout(id);
  }, [connWs]);
  return showOffline;
}
