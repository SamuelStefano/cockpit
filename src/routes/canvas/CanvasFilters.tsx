import type { AreaId } from '../../../shared/canvas';
import { AREA_LABELS } from '../../../shared/canvas';
import { Badge, Button, Icon, Input, Tabs, ToggleChip } from '../../components/primitives';
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
  query: string;
  onQuery: (q: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onNewCard: () => void;
  counts: { sessions: number; contexts: number; terminals: number; cards: number; waiting: number; hotContext: number; conflicts: number };
  areaCounts: { area: AreaId; count: number }[];
  areaFilter: AreaId | null;
  onAreaFilter: (a: AreaId | null) => void;
}

const MODES = [
  { id: 'canvas' as const, label: 'canvas' },
  { id: 'kanban' as const, label: 'kanban' },
  { id: 'chain' as const, label: 'cadeia' },
];

export function CanvasFilters(p: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-neutral-800/80 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Icon name="layers" size={14} className="text-orange-400" />
        <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">canvas</span>
        <Badge>{p.counts.terminals} terminais · {p.counts.sessions} sessões · {p.counts.contexts} contextos · {p.counts.cards} cards</Badge>
        {p.counts.waiting > 0 && <Badge tone="yellow">{p.counts.waiting} esperando</Badge>}
        {p.counts.hotContext > 0 && <Badge tone="red">{p.counts.hotContext} no limite</Badge>}
        {p.counts.conflicts > 0 && (
          <Badge tone="red">
            <Icon name="alertTriangle" size={10} />
            {p.counts.conflicts} {p.counts.conflicts === 1 ? 'conflito' : 'conflitos'}
          </Badge>
        )}
        <Tabs items={MODES} active={p.mode} onChange={p.onMode} className="mx-2 border-b-0" />
        <ToggleChip on={p.scope === 'exec'} icon="zap" onClick={() => p.onScope('exec')} title="painel de execução: só o que está rodando, esperando você, aberto num terminal, ou recém-concluído">execução</ToggleChip>
        <ToggleChip on={p.scope === 'active'} icon="clock" onClick={() => p.onScope('active')} title="tudo tocado nas últimas 48h">recentes</ToggleChip>
        <ToggleChip on={p.scope === 'all'} icon="layers" onClick={() => p.onScope('all')}>tudo</ToggleChip>
        <ToggleChip on={p.archived} icon="clock" onClick={() => p.onArchived(!p.archived)}>arquivo</ToggleChip>
        <ToggleChip on={p.showAutomation} icon="rotate" onClick={() => p.onShowAutomation(!p.showAutomation)} title="mostra sessões de automação (crons de reset, limpeza de memória, manutenção)">mostrar automações</ToggleChip>
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
