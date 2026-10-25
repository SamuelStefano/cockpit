import { useCallback, useEffect, useState } from 'react';
import type { MascotState } from '../../components/team/mascot-state';
import type { BotComputerApi } from './equipe-props';

// The preview is a snapshot, not a stream: re-read when the bot changes state
// (a turn started or ended is when the pane moves) and after a take over ends.
export function useBotComputerTab(botId: string, api: BotComputerApi, connected: boolean, state: MascotState) {
  const { botComputers, onBotComputerGet } = api;
  const [takenOver, setTakenOver] = useState(false);
  useEffect(() => { setTakenOver(false); }, [botId]);
  useEffect(() => { if (connected) onBotComputerGet(botId); }, [botId, connected, state, onBotComputerGet]);
  const release = useCallback(() => {
    setTakenOver(false);
    onBotComputerGet(botId);
  }, [botId, onBotComputerGet]);
  return {
    data: botComputers[botId],
    takenOver,
    takeOver: () => setTakenOver(true),
    release,
    refresh: () => onBotComputerGet(botId),
  };
}
