import { EmptyState } from '../../components/primitives';

export function Offline() {
  return (
    <EmptyState
      icon="circle"
      title="Desconectado"
      description="O histórico de uso fica no banco da máquina conectada. Reconecte pra ver."
    />
  );
}
