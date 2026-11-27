import { Button, EmptyState } from '../../components/primitives';

export function SkillsEmpty({ query, onDiscover }: { query: string; onDiscover?: () => void }) {
  return (
    <EmptyState
      bit="idle"
      title={query ? 'Nada encontrado' : 'Nenhuma skill instalada ainda'}
      description={query ? <>Nada para «{query}»</> : 'Escolha skills no catálogo para os agentes usarem.'}
    >
      {!query && onDiscover && <Button icon="search" onClick={onDiscover}>Descobrir skills</Button>}
    </EmptyState>
  );
}
