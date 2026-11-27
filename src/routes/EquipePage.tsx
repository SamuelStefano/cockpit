import { useEffect } from 'react';
import { Button, IconButton } from '../components/primitives';
import { TopBarAction } from '../components/chrome/sidebar/TopBarSlot';
import { TeamTabs } from '../components/chrome/team/TeamTabs';
import type { TeamTabId } from '../components/chrome/team/team-tabs';
import type { Route } from '../useRoute';
import type { Memory, MemoryInput, TeamBot } from '../../shared/protocol';
import type { BotView } from './equipe/team-view';
import { Rotinas } from './equipe/Rotinas';
import { useRotinas } from './equipe/rotinas/useRotinas';
import type { CronApi } from './equipe/equipe-props';
import { Memoria } from './equipe/Memoria';
import { TeamWorld } from './equipe/TeamWorld';
import type { TalkState } from './equipe/world/talk-state';
import type { TeamState } from '../../shared/team-state';
import type { MeetingInput, TeamMeeting } from '../../shared/team-meeting';

export type Tab = 'rotinas' | 'memoria' | 'mundo';

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
  teamState?: TeamState | null;
  onTeamStateGet?: () => void;
  meetings?: TeamMeeting[];
  onMeetingsGet?: () => void;
  onMeetingStart?: (input: MeetingInput) => void;
  teamPaused?: boolean;
  onTeamPauseSet?: (paused: boolean) => void;
  talk?: TalkState;
  onTalkOpen?: (botId: string, recording: boolean) => void;
  onTalkSend?: (botId: string, text: string, recording: boolean) => void;
  onTalkClose?: () => void;
  views: BotView[];
  connected: boolean;
  isAdmin: boolean;
  cron: CronApi & { loaded: boolean };
  bots: TeamBot[];
  onOpenChat: (id: string) => void;
  onGo: (to: Route) => void;
  capsKnown?: boolean;
}

export function EquipePage(p: EquipePageProps) {
  const { views, isAdmin, connected, onGo } = p;
  const canSeeMemory = isAdmin && !!p.memory;
  // Rotinas and Memória are admin tools; /equipe/memoria has no tab for anyone else.
  const canSeeWorld = isAdmin && !!p.onTeamStateGet;
  const tab: Tab = p.tab === 'memoria' && canSeeMemory ? 'memoria' : p.tab === 'mundo' && canSeeWorld ? 'mundo' : 'rotinas';
  const capsKnown = p.capsKnown !== false;
  useEffect(() => { if (capsKnown && ((p.tab === 'memoria' && !canSeeMemory) || (p.tab === 'mundo' && !canSeeWorld))) onGo('/'); }, [capsKnown, p.tab, canSeeMemory, canSeeWorld, onGo]);
  const r = useRotinas({ ...p.cron, bots: p.bots, connected });
  if (!capsKnown && (p.tab === 'memoria' || p.tab === 'mundo')) return <div className="flex min-h-0 flex-1" />;
  const allow: TeamTabId[] = ['pedidos', 'rotinas', ...(canSeeMemory ? ['memoria' as const] : []), ...(canSeeWorld ? ['mundo' as const] : [])];
  const counts = {
    pedidos: p.teamState ? p.teamState.followUps.length : undefined,
    rotinas: p.cron.loaded ? p.cron.crons.length : undefined,
    memoria: canSeeMemory && p.memory?.loaded ? p.memory.memories.length : undefined,
  };
  const newRoutine = isAdmin && tab === 'rotinas'
    ? <Button size="sm" variant="outline" icon="plus" onClick={r.openNew} className="max-lg:hidden">Nova rotina</Button> : undefined;
  const header = <TeamTabs role={isAdmin ? 'admin' : 'student'} active={tab} counts={counts} allow={allow} actions={newRoutine} onSelect={onGo} />;
  if (tab === 'mundo' && p.onTeamStateGet) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="flex min-h-0 flex-1 flex-col p-4 md:p-8">
        <TeamWorld
          state={p.teamState ?? null} connected={connected} onRefresh={p.onTeamStateGet} bots={p.bots} meetings={p.meetings ?? []}
          onMeetingsGet={p.onMeetingsGet ?? (() => {})} onMeetingStart={p.onMeetingStart ?? (() => {})}
          paused={p.teamPaused ?? false} onPauseSet={p.onTeamPauseSet}
          talk={p.talk} onTalkOpen={p.onTalkOpen} onTalkSend={p.onTalkSend} onTalkClose={p.onTalkClose} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[960px] p-4 md:p-8">
          <TopBarAction>
            {isAdmin && tab === 'rotinas' && <IconButton icon="plus" label="Nova rotina" side="bottom" onClick={r.openNew} className="pointer-coarse:h-11 pointer-coarse:w-11" />}
          </TopBarAction>
          {tab === 'memoria' && p.memory ? (
            <Memoria bots={views.map((v) => v.bot)} connected={connected} {...p.memory} />
          ) : (
            <Rotinas r={r} bots={p.bots} loaded={p.cron.loaded} connected={connected} isAdmin={isAdmin} onChat={p.onOpenChat} onReload={p.cron.onCronsGet} />
          )}
        </div>
      </div>
    </div>
  );
}
