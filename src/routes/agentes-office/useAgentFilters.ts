import { useMemo, useState } from 'react';
import type { BotView } from '../equipe/team-view';
import { agentRowsOf, filterBySearch, filterBySector, filterByStatus, sectorChips, statusChips, type SectorFilter, type StatusFilter } from './agent-list';

export function useAgentFilters(views: BotView[]) {
  const [sector, setSector] = useState<SectorFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const sectors = useMemo(() => sectorChips(views), [views]);
  const statuses = useMemo(() => statusChips(views), [views]);
  const activeSector = sectors.some((c) => c.id === sector) ? sector : 'all';
  const rows = useMemo(
    () => agentRowsOf(filterBySearch(filterByStatus(filterBySector(views, activeSector), status), query), views),
    [views, activeSector, status, query],
  );
  const filtered = activeSector !== 'all' || status !== 'all' || query.trim() !== '';
  const clear = () => { setSector('all'); setStatus('all'); setQuery(''); };
  return { sectors, statuses, sector: activeSector, status, query, rows, filtered, setSector, setStatus, setQuery, clear };
}
