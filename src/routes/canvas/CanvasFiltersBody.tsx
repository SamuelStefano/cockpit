import type { AreaId } from '../../../shared/canvas';
import { AREA_LABELS } from '../../../shared/canvas';
import { Badge, Button, Icon, Input, ToggleChip } from '../../components/primitives';
import type { CanvasScope } from './canvas-filter';

interface Props {
  scope: CanvasScope;
  onScope: (s: CanvasScope) => void;
  archived: boolean;
  onArchived: (v: boolean) => void;
  showAutomation: boolean;
  onShowAutomation: (v: boolean) => void;
  showContexts: boolean;
  onShowContexts: (v: boolean) => void;
  query: string;
  onQuery: (q: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onNewCard: () => void;
  counts: { hotContext: number; conflicts: number };
  areaCounts: { area: AreaId; count: number }[];
  areaFilter: AreaId | null;
  onAreaFilter: (a: AreaId | null) => void;
}

// The scope/archive/automation/search/area controls — everything BELOW the
// status line. Shared between the inline desktop row (CanvasFilters) and the
// mobile "filtros" Drawer (item 11) so the two never drift apart.
export function CanvasFiltersBody(p: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {p.counts.hotContext > 0 && <Badge tone="red">{p.counts.hotContext} no limite</Badge>}
        {p.counts.conflicts > 0 && (
          <Badge tone="red">
            <Icon name="alertTriangle" size={10} />
            {p.counts.conflicts} {p.counts.conflicts === 1 ? 'conflito' : 'conflitos'}
          </Badge>
        )}
        <ToggleChip on={p.scope === 'exec'} icon="zap" onClick={() => p.onScope('exec')} title="painel de execução: só o que está rodando, esperando você, aberto num terminal, ou recém-concluído">execução</ToggleChip>
        <ToggleChip on={p.scope === 'active'} icon="clock" onClick={() => p.onScope('active')} title="tudo tocado nas últimas 48h">recentes</ToggleChip>
        <ToggleChip on={p.scope === 'all'} icon="layers" onClick={() => p.onScope('all')}>tudo</ToggleChip>
        <ToggleChip on={p.archived} icon="clock" onClick={() => p.onArchived(!p.archived)}>arquivo</ToggleChip>
        <ToggleChip on={p.showAutomation} icon="rotate" onClick={() => p.onShowAutomation(!p.showAutomation)} title="mostra sessões de automação (crons de reset, limpeza de memória, manutenção)">mostrar automações</ToggleChip>
        {p.scope !== 'all' && (
          <ToggleChip on={p.showContexts} icon="file" onClick={() => p.onShowContexts(!p.showContexts)} title="mostra os nós de memória/contexto (hubs, leafs) por cima das sessões">contextos</ToggleChip>
        )}
        <div className="w-full sm:w-56">
          <Input size="sm" icon="search" placeholder="buscar sessão ou contexto" value={p.query} onChange={(e) => p.onQuery(e.target.value)} />
        </div>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" icon="rotate" loading={p.loading} onClick={p.onRefresh}>atualizar</Button>
        <Button size="sm" icon="plus" onClick={p.onNewCard}>card</Button>
      </div>
      {p.areaCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <ToggleChip on={p.areaFilter === null} icon="layers" onClick={() => p.onAreaFilter(null)}>todas as áreas</ToggleChip>
          {p.areaCounts.map(({ area, count }) => (
            <ToggleChip key={area} on={p.areaFilter === area} icon="layers" onClick={() => p.onAreaFilter(p.areaFilter === area ? null : area)}>
              {AREA_LABELS[area]} <span className="opacity-60">{count}</span>
            </ToggleChip>
          ))}
        </div>
      )}
    </div>
  );
}
