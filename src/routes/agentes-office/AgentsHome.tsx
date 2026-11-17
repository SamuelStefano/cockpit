import { useEffect } from 'react';
import type { SkillMeta, TeamBot, TeamBotInput } from '../../../shared/protocol';
import type { MeetingInput, TeamMeeting } from '../../../shared/team-meeting';
import { Tabs, type TabItem } from '../../components/primitives';
import type { BotView } from '../equipe/team-view';
import { Office } from './Office';
import { AgentStore } from './store/AgentStore';
import { MeetingsTab } from './meetings/MeetingsTab';

export type OfficeTab = 'escritorio' | 'loja' | 'reunioes';

const TABS: TabItem<OfficeTab>[] = [{ id: 'escritorio', label: 'Escritório' }, { id: 'loja', label: 'Loja' }, { id: 'reunioes', label: 'Reuniões' }];

interface AgentsHomeProps {
  tab: OfficeTab;
  onTab: (tab: OfficeTab) => void;
  views: BotView[];
  bots: TeamBot[];
  skills: SkillMeta[];
  connected: boolean;
  canEdit: boolean;
  onSkillList?: () => void;
  onSave: (bot: TeamBotInput) => void;
  onOpen: (id: string) => void;
  onProfile: (id: string) => void;
  onNew?: () => void;
  meetings?: TeamMeeting[];
  onMeetingsGet?: () => void;
  onMeetingStart?: (input: MeetingInput) => void;
}

const noop = () => {};

export function AgentsHome({ tab, onTab, views, bots, skills, connected, canEdit, onSkillList, onSave, onOpen, onProfile, onNew, meetings = [], onMeetingsGet, onMeetingStart }: AgentsHomeProps) {
  useEffect(() => { if (connected && tab === 'loja') onSkillList?.(); }, [connected, tab, onSkillList]);
  return (
    <div className="flex flex-col gap-4">
      <Tabs items={TABS} active={tab} onChange={onTab} />
      {tab === 'reunioes'
        ? <MeetingsTab meetings={meetings} bots={bots} connected={connected} canEdit={canEdit} onGet={onMeetingsGet ?? noop} onStart={onMeetingStart ?? noop} />
        : tab === 'loja'
        ? <AgentStore bots={bots} skills={skills} canEdit={canEdit} onSave={onSave} onHired={(firstId, count) => (count === 1 ? onProfile(firstId) : onTab('escritorio'))} />
        : <Office views={views} onOpen={onOpen} onNew={onNew} heading={false} />}
    </div>
  );
}
