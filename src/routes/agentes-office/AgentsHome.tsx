import { useEffect, useState } from 'react';
import type { SkillMeta, TeamBot, TeamBotInput } from '../../../shared/protocol';
import type { MeetingInput, TeamMeeting } from '../../../shared/team-meeting';
import type { ExecutorState, HeavyJob, JobInput } from '../../../shared/heavy-job';
import { Segmented, Tabs, type SegmentedItem, type TabItem } from '../../components/primitives';
import type { AgentTab } from '../../useRoute';
import type { BotView } from '../equipe/team-view';
import { AgentList } from './AgentList';
import { Office } from './Office';
import { AgentStore } from './store/AgentStore';
import { MeetingsTab } from './meetings/MeetingsTab';
import { ExecutorTab } from './executor/ExecutorTab';

type EscritorioView = 'lista' | 'escritorio';
const VIEWS: SegmentedItem<EscritorioView>[] = [{ id: 'lista', label: 'Lista' }, { id: 'escritorio', label: 'Escritório' }];

export type OfficeTab = 'escritorio' | 'loja' | 'reunioes' | 'executor';

const TABS: TabItem<OfficeTab>[] = [{ id: 'escritorio', label: 'Escritório' }, { id: 'loja', label: 'Loja' }, { id: 'reunioes', label: 'Reuniões' }, { id: 'executor', label: 'Executor' }];

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
  onProfile: (id: string, tab?: AgentTab) => void;
  onNew?: () => void;
  meetings?: TeamMeeting[];
  onMeetingsGet?: () => void;
  onMeetingStart?: (input: MeetingInput) => void;
  executor?: ExecutorState;
  heavyJobs?: HeavyJob[];
  onHeavyGet?: () => void;
  onHeavyRun?: (input: JobInput) => void;
  onHeavyCancel?: (id: string) => void;
}

const noop = () => {};
const NO_EXECUTOR: ExecutorState = { configured: false, label: '', online: null };

export function AgentsHome({ tab, onTab, views, bots, skills, connected, canEdit, onSkillList, onSave, onOpen, onProfile, onNew, meetings = [], onMeetingsGet, onMeetingStart, executor, heavyJobs = [], onHeavyGet, onHeavyRun, onHeavyCancel }: AgentsHomeProps) {
  const [view, setView] = useState<EscritorioView>('lista');
  useEffect(() => { if (connected && tab === 'loja') onSkillList?.(); }, [connected, tab, onSkillList]);
  useEffect(() => { if (connected && canEdit) onHeavyGet?.(); }, [connected, canEdit, onHeavyGet]);
  return (
    <div className="flex flex-col gap-4">
      <Tabs items={TABS} active={tab} onChange={onTab} />
      {tab === 'executor'
        ? <ExecutorTab executor={executor ?? NO_EXECUTOR} jobs={heavyJobs} bots={bots} canEdit={canEdit} onRun={onHeavyRun ?? noop} onCancel={onHeavyCancel ?? noop} />
        : tab === 'reunioes'
        ? <MeetingsTab meetings={meetings} bots={bots} connected={connected} canEdit={canEdit} onGet={onMeetingsGet ?? noop} onStart={onMeetingStart ?? noop} />
        : tab === 'loja'
        ? <AgentStore bots={bots} skills={skills} canEdit={canEdit} onSave={onSave} onHired={(firstId, count) => (count === 1 ? onProfile(firstId) : onTab('escritorio'))} />
        : (
          <>
            <div className="flex justify-end"><Segmented items={VIEWS} value={view} onChange={setView} label="Visão dos agentes" /></div>
            {view === 'lista'
              ? <AgentList views={views} onChat={onOpen} onWorkspace={(id) => onProfile(id, 'arquivos')} onProfile={(id) => onProfile(id, 'perfil')} onNew={onNew} executor={executor} heavyJobs={heavyJobs} onOpenExecutor={() => onTab('executor')} />
              : <Office views={views} onOpen={onOpen} onNew={onNew} heading={false} executor={executor} heavyJobs={heavyJobs} onOpenExecutor={() => onTab('executor')} />}
          </>
        )}
    </div>
  );
}
