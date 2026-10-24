import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg, TeamBot, TeamBotInput } from '../../shared/protocol';
import { mergeTeamMessages, type TeamMessage } from '../../shared/team-messages';

export interface TeamMessagesQuery { botId?: string; peer?: string; before?: number }

export interface Team {
  bots: TeamBot[];
  teamLoaded: boolean;
  teamMessages: TeamMessage[];
  teamPaused: boolean;
  onTeamGet: () => void;
  onTeamSave: (bot: TeamBotInput) => void;
  onTeamDelete: (id: string) => void;
  onTeamMessagesGet: (q?: TeamMessagesQuery) => void;
  onTeamPauseSet: (paused: boolean) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useTeam(send: (m: ClientMsg) => boolean): Team {
  const [bots, setBots] = useState<TeamBot[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [teamPaused, setTeamPaused] = useState(false);

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
      default:
        return false;
    }
  }, []);

  return {
    bots,
    teamLoaded,
    teamMessages,
    teamPaused,
    onTeamGet: useCallback(() => { send({ t: 'team-get' }); }, [send]),
    onTeamSave: useCallback((bot: TeamBotInput) => { send({ t: 'team-save', bot }); }, [send]),
    onTeamDelete: useCallback((id: string) => { send({ t: 'team-delete', id }); }, [send]),
    onTeamMessagesGet: useCallback((q: TeamMessagesQuery = {}) => { send({ t: 'team-messages-get', ...q }); }, [send]),
    onTeamPauseSet: useCallback((paused: boolean) => { send({ t: 'team-pause-set', paused }); }, [send]),
    onMsg,
  };
}
