import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg, TeamBot, TeamBotInput, TeamPendingQuestion } from '../../shared/protocol';
import type { MeetingInput, TeamMeeting } from '../../shared/team-meeting';
import { mergeTeamMessages, type TeamMessage } from '../../shared/team-messages';
import type { TeamState } from '../../shared/team-state';

export interface AgentBuildResult { reqId: string; ok: boolean; text?: string; error?: string }
export type AgentBuildRequest = Omit<Extract<ClientMsg, { t: 'agent-build' }>, 't'>;

export interface TeamMessagesQuery { botId?: string; peer?: string; before?: number }

export interface Team {
  bots: TeamBot[];
  teamLoaded: boolean;
  teamMessages: TeamMessage[];
  teamPaused: boolean;
  pendingQuestions: TeamPendingQuestion[];
  meetings: TeamMeeting[];
  teamState: TeamState | null;
  onTeamStateGet: () => void;
  onMeetingsGet: () => void;
  onMeetingStart: (input: MeetingInput) => void;
  onTeamGet: () => void;
  onTeamSave: (bot: TeamBotInput) => void;
  onTeamDelete: (id: string) => void;
  onTeamSyncSource: (id: string) => void;
  onTeamMessagesGet: (q?: TeamMessagesQuery) => void;
  onTeamPauseSet: (paused: boolean) => void;
  agentBuild: AgentBuildResult | null;
  onAgentBuild: (req: AgentBuildRequest) => boolean;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useTeam(send: (m: ClientMsg) => boolean): Team {
  const [bots, setBots] = useState<TeamBot[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [teamPaused, setTeamPaused] = useState(false);
  const [agentBuild, setAgentBuild] = useState<AgentBuildResult | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<TeamPendingQuestion[]>([]);
  const [meetings, setMeetings] = useState<TeamMeeting[]>([]);
  const [teamState, setTeamState] = useState<TeamState | null>(null);

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'team':
        setBots(msg.bots);
        setTeamLoaded(true);
        return true;
      case 'team-messages':
        setTeamMessages((prev) => mergeTeamMessages(prev, msg.items));
        return true;
      case 'team-message':
        setTeamMessages((prev) => mergeTeamMessages(prev, [msg.item]));
        return true;
      case 'team-paused':
        setTeamPaused(msg.paused);
        return true;
      case 'agent-build-result':
        setAgentBuild({ reqId: msg.reqId, ok: msg.ok, text: msg.text, error: msg.error });
        return true;
      case 'team-meetings':
        setMeetings(msg.items);
        return true;
      case 'team-meeting':
        setMeetings((prev) => [msg.item, ...prev.filter((m) => m.id !== msg.item.id)].sort((a, b) => b.createdAt - a.createdAt));
        return true;
      case 'team-pending':
        setPendingQuestions(msg.items);
        return true;
      case 'team-state':
        setTeamState(msg.state);
        return true;
      default:
        return false;
    }
  }, []);

  return {
    bots,
    teamLoaded,
    teamMessages,
    teamPaused,
    pendingQuestions,
    meetings,
    teamState,
    onTeamStateGet: useCallback(() => { send({ t: 'team-state-get' }); }, [send]),
    onMeetingsGet: useCallback(() => { send({ t: 'team-meetings-get' }); }, [send]),
    onMeetingStart: useCallback((input: MeetingInput) => { send({ t: 'team-meeting-start', ...input }); }, [send]),
    agentBuild,
    onAgentBuild: useCallback((req: AgentBuildRequest) => send({ t: 'agent-build', ...req }), [send]),
    onTeamGet: useCallback(() => { send({ t: 'team-get' }); }, [send]),
    onTeamSave: useCallback((bot: TeamBotInput) => { send({ t: 'team-save', bot }); }, [send]),
    onTeamDelete: useCallback((id: string) => { send({ t: 'team-delete', id }); }, [send]),
    onTeamSyncSource: useCallback((id: string) => { send({ t: 'team-sync-source', id }); }, [send]),
    onTeamMessagesGet: useCallback((q: TeamMessagesQuery = {}) => { send({ t: 'team-messages-get', ...q }); }, [send]),
    onTeamPauseSet: useCallback((paused: boolean) => { send({ t: 'team-pause-set', paused }); }, [send]),
    onMsg,
  };
}
