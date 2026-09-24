import { useState } from 'react';
import type { AreaId } from '../../../shared/canvas';
import { Badge, Button, Drawer, Icon, Tabs, type IconName } from '../../components/primitives';
import type { StatusSummary, StatusChip } from './canvas-alerts';
import { CanvasFiltersBody } from './CanvasFiltersBody';
import type { CanvasScope } from './canvas-filter';
import type { CanvasMode } from './useCanvasRoute';

interface Props {
  mode: CanvasMode;
  onMode: (m: CanvasMode) => void;
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
  counts: { sessions: number; contexts: number; terminals: number; cards: number; hotContext: number; conflicts: number };
  areaCounts: { area: AreaId; count: number }[];
  areaFilter: AreaId | null;
  onAreaFilter: (a: AreaId | null) => void;
  // "Who needs me" (review item 1) — one row above everything else, built
  // from the SAME running∪cv-live set CanvasHud counts, so the two never
  // show different numbers for the same question.
  statusSummary: StatusSummary;
  onFocusStatusItem: (nodeId: string) => void;
}

const MODES = [
  { id: 'canvas' as const, label: 'canvas' },
  { id: 'kanban' as const, label: 'kanban' },
  { id: 'chain' as const, label: 'cadeia' },
];

function StatusChipBadge({ chip, icon, tone, label, onFocus }: {
  chip: StatusChip; icon?: IconName; tone: 'green' | 'yellow' | 'red' | 'neutral'; label: string; onFocus: (nodeId: string) => void;
}) {
  return (
    <Badge tone={tone} dot={!icon} onClick={chip.firstNodeId ? () => onFocus(chip.firstNodeId!) : undefined} title={chip.count > 0 ? `focar: ${label}` : undefined}>
      {icon && <Icon name={icon} size={10} />}
      {chip.count} {label}
    </Badge>
  );
}

// Non-default filters currently applied — the "filtros" drawer trigger's
// badge on mobile, so closing it doesn't hide the fact something is filtered.
function activeFilterCount(p: Props): number {
  let n = 0;
  if (p.scope !== 'exec') n += 1;
  if (p.archived) n += 1;
  if (p.showAutomation) n += 1;
  if (p.showContexts) n += 1;
  if (p.areaFilter) n += 1;
  if (p.query.trim()) n += 1;
  return n;
}

export function CanvasFilters(p: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = activeFilterCount(p);
  const inventoryTitle = `${p.counts.terminals} terminais · ${p.counts.sessions} sessões · ${p.counts.contexts} contextos · ${p.counts.cards} cards`;
  const bodyProps = {
    scope: p.scope, onScope: p.onScope, archived: p.archived, onArchived: p.onArchived,
    showAutomation: p.showAutomation, onShowAutomation: p.onShowAutomation,
    showContexts: p.showContexts, onShowContexts: p.onShowContexts,
    query: p.query, onQuery: p.onQuery, loading: p.loading, onRefresh: p.onRefresh, onNewCard: p.onNewCard,
    counts: { hotContext: p.counts.hotContext, conflicts: p.counts.conflicts },
    areaCounts: p.areaCounts, areaFilter: p.areaFilter, onAreaFilter: p.onAreaFilter,
  };

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-neutral-800/80 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Inventory used to be a permanent Badge here — moved to a hover
            tooltip (review item 1): the status line below answers "who needs
            me" now, the raw counts are still one hover away, never gone. */}
        <span title={inventoryTitle} className="flex shrink-0 cursor-help items-center gap-1.5">
          <Icon name="layers" size={14} className="text-orange-400" />
          <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">canvas</span>
        </span>
        <Tabs items={MODES} active={p.mode} onChange={p.onMode} className="border-b-0" />
        <span className="flex-1" />
        <div className="flex items-center gap-1 sm:hidden">
          <Button variant="ghost" size="sm" icon="sliders" onClick={() => setFiltersOpen(true)}>filtros</Button>
          {filterCount > 0 && <Badge tone="orange">{filterCount}</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChipBadge chip={p.statusSummary.running} tone="green" label="rodando" onFocus={p.onFocusStatusItem} />
        <StatusChipBadge chip={p.statusSummary.waiting} icon="pause" tone="yellow" label="esperando você" onFocus={p.onFocusStatusItem} />
        <StatusChipBadge chip={p.statusSummary.errored} icon="alertTriangle" tone="red" label="parou com erro" onFocus={p.onFocusStatusItem} />
        <StatusChipBadge chip={p.statusSummary.doneRecent} icon="check" tone="neutral" label="terminaram (24h)" onFocus={p.onFocusStatusItem} />
      </div>
      <div className="hidden sm:block">
        <CanvasFiltersBody {...bodyProps} />
      </div>
      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="filtros" side="right">
        <div className="p-3">
          <CanvasFiltersBody {...bodyProps} />
        </div>
      </Drawer>
    </div>
  );
}
