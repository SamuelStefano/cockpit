import { useEffect } from 'react';
import { Button, EmptyState, PageTitle, IconButton, Tabs, type TabItem } from '../components/primitives';
import { navigateTo } from '../lib/route-nav';
import { useIsMobile } from '../app/useIsMobile';
import { TopBarAction } from '../components/chrome/sidebar/TopBarSlot';
import type { Memory, MemoryInput, TeamBot, UsageStats } from '../../shared/protocol';
import type { BotView } from './equipe/team-view';
import { OrgTree } from './equipe/OrgTree';
import { OrgList } from './equipe/OrgList';
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
  const canSeeMemory = isAdmin && !!p.memory;
  // /equipe/memoria has no tab for non-admins: fall back instead of an orphan tab strip.
  const tab = p.tab === 'memoria' && !canSeeMemory ? 'agentes' : p.tab ?? 'agentes';
  const { onGo } = p;
  useEffect(() => { if (p.tab === 'memoria' && !canSeeMemory) onGo('/equipe'); }, [p.tab, canSeeMemory, onGo]);
  const phone = useIsMobile();
  const counts = todayCounts(views, p.usageStats?.series);
  const r = useRotinas({ ...p.cron, bots: p.bots, connected });
  const items: TabItem<Tab>[] = [
    { id: 'agentes', label: 'Agentes', count: views.length },
    { id: 'rotinas', label: 'Rotinas', count: p.cron.loaded ? p.cron.crons.length : undefined },
    ...(isAdmin && p.memory ? [{ id: 'memoria' as const, label: 'Memória', count: p.memory.loaded ? p.memory.memories.length : undefined }] : []),
  ];
  const onTab = (t: Tab) => { if (t === 'rotinas') p.onGo('/equipe/rotinas'); else if (t === 'memoria') p.onGo('/equipe/memoria'); else p.onGo('/equipe'); };
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[960px] p-4 max-lg:pt-1 md:p-8">
        <header className="mb-5 flex flex-wrap items-center gap-3 max-lg:hidden">
          <PageTitle icon="users" tone="sky">Equipe</PageTitle>
          <div className="ml-auto flex gap-2">
            {isAdmin && tab === 'rotinas' && <Button size="sm" variant="outline" icon="plus" onClick={r.openNew}>Nova rotina</Button>}
            {isAdmin && tab !== 'rotinas' && <Button size="sm" icon="plus" onClick={p.onNew}>Novo agente</Button>}
          </div>
        </header>
        <TopBarAction>
          {isAdmin && tab === 'agentes' && views.length > 1 && (
            <IconButton icon="pause" label={p.paused ? 'Retomar equipe' : 'Pausar equipe'} side="bottom" onClick={() => p.onPauseSet(!p.paused)} className="pointer-coarse:h-11 pointer-coarse:w-11" />
          )}
          {isAdmin && tab === 'rotinas' && <IconButton icon="plus" label="Nova rotina" side="bottom" onClick={r.openNew} className="pointer-coarse:h-11 pointer-coarse:w-11" />}
          {isAdmin && tab === 'agentes' && <IconButton icon="plus" label="Novo agente" side="bottom" onClick={p.onNew} className="pointer-coarse:h-11 pointer-coarse:w-11" />}
        </TopBarAction>
        <Tabs items={items} active={tab} onChange={onTab} className="mb-2.5 lg:mb-5" />
        {tab === 'memoria' && p.memory ? (
          <Memoria bots={views.map((v) => v.bot)} connected={connected} {...p.memory} />
        ) : tab === 'rotinas' ? (
          <Rotinas r={r} bots={p.bots} loaded={p.cron.loaded} connected={connected} isAdmin={isAdmin} onChat={p.onOpenChat} onReload={p.cron.onCronsGet} />
        ) : (
          <>
            {phone ? (
              <>
                {views.length > 0 && <p aria-label="Resumo da equipe" className="mb-2 text-[13px] text-neutral-400">{counts.working} trabalhando · {counts.waiting} esperando você</p>}
                {views.length === 0 ? (
                  <EmptyState bit="wave" size="sm" title="Nenhum agente ainda" description="Agentes trabalham sozinhos em rotinas e respondem no chat.">
                    {isAdmin ? <Button icon="plus" onClick={p.onNew}>Novo agente</Button> : <Button variant="secondary" onClick={() => navigateTo('/')}>Ver no chat</Button>}
                  </EmptyState>
                ) : <OrgList views={views} onOpen={p.onOpenAgent} />}
              </>
            ) : (
              <>
                <TodayNumbers counts={counts} />
                <OrgTree views={views} onOpen={p.onOpenAgent} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
