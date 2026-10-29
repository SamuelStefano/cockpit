import { useEffect } from 'react';
import { Button, PageTitle, IconButton, Tabs, type TabItem } from '../components/primitives';
import { TopBarAction } from '../components/chrome/sidebar/TopBarSlot';
import type { Memory, MemoryInput, TeamBot } from '../../shared/protocol';
import type { BotView } from './equipe/team-view';
import { Rotinas } from './equipe/Rotinas';
import { useRotinas } from './equipe/rotinas/useRotinas';
import type { CronApi } from './equipe/equipe-props';
import { Memoria } from './equipe/Memoria';

export type Tab = 'rotinas' | 'memoria';

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
  cron: CronApi & { loaded: boolean };
  bots: TeamBot[];
  onOpenChat: (id: string) => void;
  onGo: (to: '/' | '/equipe/rotinas' | '/equipe/memoria') => void;
}

export function EquipePage(p: EquipePageProps) {
  const { views, isAdmin, connected, onGo } = p;
  const canSeeMemory = isAdmin && !!p.memory;
  // Rotinas and Memória are admin tools; /equipe/memoria has no tab for anyone else.
  const tab: Tab = p.tab === 'memoria' && canSeeMemory ? 'memoria' : 'rotinas';
  useEffect(() => { if (p.tab === 'memoria' && !canSeeMemory) onGo('/'); }, [p.tab, canSeeMemory, onGo]);
  const r = useRotinas({ ...p.cron, bots: p.bots, connected });
  const items: TabItem<Tab>[] = [
    { id: 'rotinas', label: 'Rotinas', count: p.cron.loaded ? p.cron.crons.length : undefined },
    ...(canSeeMemory && p.memory ? [{ id: 'memoria' as const, label: 'Memória', count: p.memory.loaded ? p.memory.memories.length : undefined }] : []),
  ];
  const onTab = (t: Tab) => onGo(t === 'memoria' ? '/equipe/memoria' : '/equipe/rotinas');
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[960px] p-4 max-lg:pt-1 md:p-8">
        <header className="mb-5 flex flex-wrap items-center gap-3 max-lg:hidden">
          <PageTitle icon="clock" tone="sky">{tab === 'memoria' ? 'Memória' : 'Rotinas'}</PageTitle>
          <div className="ml-auto flex gap-2">
            {isAdmin && tab === 'rotinas' && <Button size="sm" variant="outline" icon="plus" onClick={r.openNew}>Nova rotina</Button>}
          </div>
        </header>
        <TopBarAction>
          {isAdmin && tab === 'rotinas' && <IconButton icon="plus" label="Nova rotina" side="bottom" onClick={r.openNew} className="pointer-coarse:h-11 pointer-coarse:w-11" />}
        </TopBarAction>
        <Tabs items={items} active={tab} onChange={onTab} className="mb-2.5 lg:mb-5" />
        {tab === 'memoria' && p.memory ? (
          <Memoria bots={views.map((v) => v.bot)} connected={connected} {...p.memory} />
        ) : (
          <Rotinas r={r} bots={p.bots} loaded={p.cron.loaded} connected={connected} isAdmin={isAdmin} onChat={p.onOpenChat} onReload={p.cron.onCronsGet} />
        )}
      </div>
    </div>
  );
}
