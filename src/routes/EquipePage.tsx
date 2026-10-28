import { useEffect } from 'react';
import { Button, Tabs, type TabItem } from '../components/primitives';
import type { Memory, MemoryInput, TeamBot, UsageStats } from '../../shared/protocol';
import type { BotView } from './equipe/team-view';
import { OrgTree } from './equipe/OrgTree';
import { TodayNumbers } from './equipe/TodayNumbers';
import { todayCounts } from './equipe/org-tree';
import { Rotinas } from './equipe/Rotinas';
import { useRotinas } from './equipe/rotinas/useRotinas';
import type { CronApi } from './equipe/equipe-props';
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
  cron: CronApi & { loaded: boolean };
  bots: TeamBot[];
  onOpenChat: (id: string) => void;
  onOpenAgent: (id: string) => void;
  onNew: () => void;
  onPauseSet: (paused: boolean) => void;
  onUsageList: () => void;
  onGo: (to: '/equipe' | '/equipe/rotinas' | '/equipe/memoria') => void;
}

export function EquipePage(p: EquipePageProps) {
  const { views, isAdmin, connected, onUsageList } = p;
  useEffect(() => { if (connected && isAdmin) onUsageList(); }, [connected, isAdmin, onUsageList]);
  const tab = p.tab ?? 'agentes';
  const r = useRotinas({ ...p.cron, bots: p.bots, connected });
  const items: TabItem<Tab>[] = [
    { id: 'agentes', label: 'Agentes', count: views.length },
    { id: 'rotinas', label: 'Rotinas', count: p.cron.loaded ? p.cron.crons.length : undefined },
    ...(isAdmin && p.memory ? [{ id: 'memoria' as const, label: 'Memória', count: p.memory.loaded ? p.memory.memories.length : undefined }] : []),
  ];
  const onTab = (t: Tab) => { if (t === 'rotinas') p.onGo('/equipe/rotinas'); else if (t === 'memoria') p.onGo('/equipe/memoria'); else p.onGo('/equipe'); };
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[960px] p-4 md:p-8">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-neutral-100">Equipe</h1>
          <div className="ml-auto flex gap-2">
            {isAdmin && tab !== 'rotinas' && views.length > 1 && (
              <Button variant="ghost" size="sm" icon="pause" onClick={() => p.onPauseSet(!p.paused)}>
                {p.paused ? 'Retomar equipe' : 'Pausar equipe'}
              </Button>
            )}
            {isAdmin && tab === 'rotinas' && <Button size="sm" variant="outline" icon="plus" onClick={r.openNew}>Nova rotina</Button>}
            {isAdmin && tab !== 'rotinas' && <Button size="sm" icon="plus" onClick={p.onNew}>Novo agente</Button>}
          </div>
        </header>
        <Tabs items={items} active={tab} onChange={onTab} className="mb-5" />
        {tab === 'memoria' && p.memory ? (
          <Memoria bots={views.map((v) => v.bot)} connected={connected} {...p.memory} />
        ) : tab === 'rotinas' ? (
          <Rotinas r={r} bots={p.bots} loaded={p.cron.loaded} connected={connected} isAdmin={isAdmin} onChat={p.onOpenChat} onReload={p.cron.onCronsGet} />
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
