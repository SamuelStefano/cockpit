import { EmptyState } from '../../components/primitives';

export function ContextOffline() {
  return (
    <EmptyState
      icon="circle"
      title="Desconectado"
      description={<>
        Os contextos ficam na máquina conectada (<span className="font-mono">memory/</span>). Reconecte pra ver.
      </>}
    />
  );
}
