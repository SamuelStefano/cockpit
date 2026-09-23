import { useEffect, useState } from 'react';
import { Button, EmptyState } from '../../components/primitives';

interface Props {
  loadingSince: number | null;
  stale: boolean;
  onRetry: () => void;
}

// Isolated so the 1s ticker only re-renders this small panel, not the whole
// canvas route. `stale` wins once the useCanvas timeout fires — a backend
// that predates canvas-get never answers, so this is the only way out of
// "Montando o grafo" forever.
export function CanvasLoadingState({ loadingSince, stale, onRetry }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stale || loadingSince == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stale, loadingSince]);

  if (stale) {
    return (
      <EmptyState icon="circle" title="O servidor do Deck ainda não tem o canvas" description="Pode estar defasado — atualize o Deck e tente de novo.">
        <Button variant="secondary" onClick={onRetry}>tentar de novo</Button>
      </EmptyState>
    );
  }

  const elapsedS = loadingSince != null ? Math.max(0, Math.floor((now - loadingSince) / 1000)) : 0;
  return (
    <EmptyState icon="layers" title="Montando o grafo" description={`A primeira leitura varre todos os transcripts; depois é incremental. Montando… ${elapsedS}s`} />
  );
}
