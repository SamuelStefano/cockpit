import { useEffect } from 'react';

interface Args {
  connected: boolean;
  onDflGet: () => void;
}

// Asks for the DFL snapshot when the socket connects; the server push keeps it
// fresh afterwards.
export function useDflPontos({ connected, onDflGet }: Args) {
  useEffect(() => { if (connected) onDflGet(); }, [connected, onDflGet]);
}
