import { EmptyState } from '../../components/primitives';

export function ContextEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      icon="sparkles"
      title={query ? 'Nada encontrado' : 'Nenhum contexto ainda'}
      description={query ? <>Nada para «{query}»</> : 'As memórias do agente aparecem aqui assim que forem criadas.'}
    />
  );
}
