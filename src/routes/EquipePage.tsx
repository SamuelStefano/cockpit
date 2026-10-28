import { useEffect } from 'react';
import { Button, Tabs, type TabItem } from '../components/primitives';
import type { UsageStats } from '../../shared/protocol';
import type { BotView } from './equipe/team-view';
import { OrgTree } from './equipe/OrgTree';
import { TodayNumbers } from './equipe/TodayNumbers';
import { todayCounts } from './equipe/org-tree';

type Tab = 'agentes' | 'rotinas' | 'memoria';

interface EquipePageProps {
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
  onGo: (to: '/crons' | '/contextos') => void;
}

export function EquipePage(p: EquipePageProps) {
  const { views, isAdmin, connected, onUsageList } = p;
  useEffect(() => { if (connected && isAdmin) onUsageList(); }, [connected, isAdmin, onUsageList]);
  const items: TabItem<Tab>[] = [
    { id: 'agentes', label: 'Agentes', count: views.length },
    { id: 'rotinas', label: 'Rotinas', count: p.cronCount },
    { id: 'memoria', label: 'Memória' },
  ];
  const onTab = (t: Tab) => { if (t === 'rotinas') p.onGo('/crons'); else if (t === 'memoria') p.onGo('/contextos'); };
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
        <Tabs items={items} active="agentes" onChange={onTab} className="mb-5" />
        <TodayNumbers counts={todayCounts(views, p.usageStats?.series)} />
        <OrgTree views={views} onOpen={p.onOpenAgent} />
      </div>
    </div>
  );
}
