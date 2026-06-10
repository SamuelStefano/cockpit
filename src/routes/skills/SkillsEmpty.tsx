import { EmptyState } from '../../components/primitives';

export function SkillsEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      icon="sparkles"
      title={query ? 'Nada encontrado' : 'Nenhuma skill ainda'}
      description={query ? <>Nada para «{query}»</> : 'As skills do agente aparecem aqui assim que forem criadas.'}
    />
  );
}
