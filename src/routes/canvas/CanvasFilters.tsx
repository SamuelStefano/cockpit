import { Button, Input, Tabs, ToggleChip } from '../../components/primitives';
import type { CanvasScope } from './canvas-filter';
import type { CanvasMode } from './useCanvasRoute';

interface Props {
  mode: CanvasMode;
  onMode: (m: CanvasMode) => void;
  scope: CanvasScope;
  onScope: (s: CanvasScope) => void;
  archived: boolean;
  onArchived: (v: boolean) => void;
  query: string;
  onQuery: (q: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onNewCard: () => void;
}

const MODES = [{ id: 'split' as const, label: 'dividido' }, { id: 'canvas' as const, label: 'canvas' }, { id: 'kanban' as const, label: 'kanban' }];

export function CanvasFilters(p: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-neutral-800/80 px-3 py-2">
      <Tabs items={MODES} active={p.mode} onChange={p.onMode} className="mr-2 border-b-0" />
      <ToggleChip on={p.scope === 'active'} icon="zap" onClick={() => p.onScope('active')}>ativas (7d)</ToggleChip>
      <ToggleChip on={p.scope === 'all'} icon="layers" onClick={() => p.onScope('all')}>todas</ToggleChip>
      <ToggleChip on={p.archived} icon="clock" onClick={() => p.onArchived(!p.archived)}>arquivo</ToggleChip>
      <div className="w-full sm:w-56">
        <Input size="sm" icon="search" placeholder="buscar sessão ou contexto" value={p.query} onChange={(e) => p.onQuery(e.target.value)} />
      </div>
      <span className="flex-1" />
      <Button variant="ghost" size="sm" icon="rotate" loading={p.loading} onClick={p.onRefresh}>atualizar</Button>
      <Button size="sm" icon="plus" onClick={p.onNewCard}>card</Button>
    </div>
  );
}
