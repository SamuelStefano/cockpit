import { useEffect, useState } from 'react';
import type { DflPointsSnapshot } from '../../../shared/protocol';

interface Args {
  connected: boolean;
  snapshot: DflPointsSnapshot | null;
  onDflGet: () => void;
}

export type PontosTab = 'arvore' | 'faturas' | 'ledger';

// Lógica financeira da rota: pede o snapshot DFL ao conectar (push mantém vivo) e
// guarda a aba ativa. O snapshot em si vem do WS; aqui só orquestramos o pedido.
export function useDflPontos({ connected, snapshot, onDflGet }: Args) {
  const [tab, setTab] = useState<PontosTab>('arvore');
  useEffect(() => { if (connected) onDflGet(); }, [connected, onDflGet]);
  const hasDfl = snapshot != null && snapshot.projects.length > 0;
  return { tab, setTab, hasDfl };
}
