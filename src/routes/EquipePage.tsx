import { useEffect } from 'react';
import { Button, Tabs, type TabItem } from '../components/primitives';
import type { Memory, MemoryInput, UsageStats } from '../../shared/protocol';
import type { BotView } from './equipe/team-view';
import { OrgTree } from './equipe/OrgTree';
import { TodayNumbers } from './equipe/TodayNumbers';
import { todayCounts } from './equipe/org-tree';
import { Memoria } from './equipe/Memoria';

export type Tab = 'agentes' | 'rotinas' | 'memoria';

export interface MemoryProps {
  memories: Memory[];
  loaded: boolean;
  onList: () => void;
  onSave: (m: MemoryInput) => void;
  onDelete: (id: string) => void;
}

interface EquipePageProps {
  tab?: Tab;
  memory?: MemoryProps;
  views: BotView[];
  connected: boolean;
  isAdmin: boolean;
  usageStats: UsageStats | null;
  paused: boolean;
  cronCount?: number;
  onOpenAgent: (id: string) => void;
  onNew: () => void;
  onPauseSet: (paused: boolean) => void;
  onUsageList: () => void;
  onGo: (to: '/crons' | '/equipe' | '/equipe/memoria') => void;
}

export function EquipePage(p: EquipePageProps) {
  const { views, isAdmin, connected, onUsageList } = p;
  useEffect(() => { if (connected && isAdmin) onUsageList(); }, [connected, isAdmin, onUsageList]);
  const items: TabItem<Tab>[] = [
    { id: 'agentes', label: 'Agentes', count: views.length },
    { id: 'rotinas', label: 'Rotinas', count: p.cronCount },
    ...(isAdmin && p.memory ? [{ id: 'memoria' as const, label: 'Memória', count: p.memory.loaded ? p.memory.memories.length : undefined }] : []),
  ];
  const tab = p.tab ?? 'agentes';
  const onTab = (t: Tab) => { if (t === 'rotinas') p.onGo('/crons'); else if (t === 'memoria') p.onGo('/equipe/memoria'); else p.onGo('/equipe'); };
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[960px] p-4 md:p-8">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-neutral-100">Equipe</h1>
          <div className="ml-auto flex gap-2">
            {isAdmin && views.length > 1 && (
              <Button variant="ghost" size="sm" icon="pause" onClick={() => p.onPauseSet(!p.paused)}>
                {p.paused ? 'Retomar equipe' : 'Pausar equipe'}
              </Button>
            )}
            {isAdmin && <Button size="sm" icon="plus" onClick={p.onNew}>Novo agente</Button>}
          </div>
        </header>
        <Tabs items={items} active={tab} onChange={onTab} className="mb-5" />
        {tab === 'memoria' && p.memory ? (
          <Memoria bots={views.map((v) => v.bot)} connected={connected} {...p.memory} />
        ) : (
          <>
            <TodayNumbers counts={todayCounts(views, p.usageStats?.series)} />
            <OrgTree views={views} onOpen={p.onOpenAgent} />
          </>
        )}
      </div>
    </div>
  );
}
