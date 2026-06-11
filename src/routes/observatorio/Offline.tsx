import { EmptyState } from '../../components/primitives';

export function Offline() {
  return (
    <EmptyState
      icon="circle"
      title="Backend local indisponível"
      description={<>
        O histórico de uso vive no SQLite local e só aparece com o backend do Deck rodando em <span className="font-mono">127.0.0.1</span>.
      </>}
    />
  );
}
