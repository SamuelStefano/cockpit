import { EmptyState } from '../../components/primitives';

export function ContextOffline() {
  return (
    <EmptyState
      icon="circle"
      title="Backend local indisponível"
      description={<>
        Os contextos vivem na sua máquina (<span className="font-mono">memory/</span>) e só aparecem com o backend do Deck
        rodando em <span className="font-mono">127.0.0.1</span>. Numa URL pública não há conexão com eles.
      </>}
    />
  );
}
