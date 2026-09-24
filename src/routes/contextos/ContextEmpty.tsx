import { Button, EmptyState } from '../../components/primitives';

// Says WHY the list is empty: a search, a type filter, or really nothing yet.
// With only a type filter it used to say "Nenhum contexto ainda".
export function ContextEmpty({ query, filter, onClearFilter }: { query: string; filter?: string | null; onClearFilter?: () => void }) {
  if (query) return <EmptyState icon="sparkles" title="Nada encontrado" description={<>Nada para «{query}»{filter ? <> em <b>{filter}</b></> : null}</>} />;
  if (filter) {
    return (
      <EmptyState icon="sparkles" title={`Nenhum contexto do tipo ${filter}`} description="Tire o filtro pra ver todos.">
        {onClearFilter && <Button variant="secondary" onClick={onClearFilter}>Ver todos</Button>}
      </EmptyState>
    );
  }
  return <EmptyState icon="sparkles" title="Nenhum contexto ainda" description="As memórias do agente aparecem aqui assim que forem criadas." />;
}
