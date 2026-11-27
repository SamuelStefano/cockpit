import { Input, ToggleChip } from '../../components/primitives';
import type { SectorChip, SectorFilter, StatusChip, StatusFilter } from './agent-list';

interface AgentFiltersProps {
  query: string;
  onQuery: (q: string) => void;
  statuses: StatusChip[];
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  sectors: SectorChip[];
  sector: SectorFilter;
  onSector: (s: SectorFilter) => void;
}

export function AgentFilters({ query, onQuery, statuses, status, onStatus, sectors, sector, onSector }: AgentFiltersProps) {
  return (
    <>
      <Input icon="search" size="sm" type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Buscar por nome, cargo ou modelo" aria-label="Buscar agentes" className="sm:max-w-sm" />
      <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-2">
        {statuses.map((c) => (
          <ToggleChip key={c.id} on={c.id === status} aria-pressed={c.id === status} onClick={() => onStatus(c.id)}>
            {c.label}<span className="text-(--text-muted)">{c.count}</span>
          </ToggleChip>
        ))}
      </div>
      {sectors.length > 1 && (
        <div role="group" aria-label="Setor" className="flex flex-wrap items-center gap-2">
          {sectors.map((c) => <ToggleChip key={c.id} on={c.id === sector} aria-pressed={c.id === sector} onClick={() => onSector(c.id)}>{c.label}</ToggleChip>)}
        </div>
      )}
    </>
  );
}
