import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg, TeamBot, TeamBotInput } from '../../shared/protocol';

export interface Team {
  bots: TeamBot[];
  teamLoaded: boolean;
  onTeamGet: () => void;
  onTeamSave: (bot: TeamBotInput) => void;
  onTeamDelete: (id: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useTeam(send: (m: ClientMsg) => boolean): Team {
  const [bots, setBots] = useState<TeamBot[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'team') return false;
    setBots(msg.bots);
    setTeamLoaded(true);
    return true;
  }, []);

  return {
    bots,
    teamLoaded,
    onTeamGet: useCallback(() => { send({ t: 'team-get' }); }, [send]),
    onTeamSave: useCallback((bot: TeamBotInput) => { send({ t: 'team-save', bot }); }, [send]),
    onTeamDelete: useCallback((id: string) => { send({ t: 'team-delete', id }); }, [send]),
    onMsg,
  };
}
