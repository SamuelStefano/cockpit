import { useCallback, useEffect, useState } from 'react';
import type { MascotState } from '../../components/team/mascot-state';
import type { BotComputerApi } from './equipe-props';
import { COMPUTER_POLL_MS, computerActive } from './computer-view';

export function useBotComputerTab(botId: string, api: BotComputerApi, connected: boolean, state: MascotState) {
  const { botComputers, onBotComputerGet } = api;
  const [takenOver, setTakenOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => { setTakenOver(false); setPreviewOpen(false); }, [botId]);
  const data = botComputers[botId];
  const termAlive = data?.status === 'ok' && data.computer.termAlive;
  const active = computerActive(state, termAlive);
  const shouldPoll = connected && !!botId && !takenOver && (previewOpen || active);
  useEffect(() => {
    if (!connected || !botId) return;
    onBotComputerGet(botId);
    if (!shouldPoll) return;
    const t = setInterval(() => onBotComputerGet(botId), COMPUTER_POLL_MS);
    return () => clearInterval(t);
  }, [botId, connected, shouldPoll, onBotComputerGet]);
  const release = useCallback(() => {
    setTakenOver(false);
    if (botId) onBotComputerGet(botId);
  }, [botId, onBotComputerGet]);
  return {
    data,
    takenOver,
    previewOpen,
    active,
    takeOver: () => setTakenOver(true),
    release,
    togglePreview: () => setPreviewOpen((v) => !v),
    closePreview: () => setPreviewOpen(false),
    refresh: () => { if (botId) onBotComputerGet(botId); },
  };
}
