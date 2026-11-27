import { useEffect, useState } from 'react';
import { wsDiffKey, type AgentHistoryApi } from '../../cockpit/useAgentHistory';

export function useAgentVersions(botId: string, api: AgentHistoryApi, connected: boolean) {
  const { onWsLogGet, onWsDiffGet } = api;
  const commits = api.wsLogs[botId];
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && commits?.some((c) => c.hash === picked) ? picked : commits?.[0]?.hash ?? null;

  useEffect(() => {
    if (connected) onWsLogGet(botId);
  }, [connected, botId, onWsLogGet]);

  const diff = selected ? api.wsDiffs[wsDiffKey(botId, selected)] : undefined;
  useEffect(() => {
    if (connected && selected && !diff) onWsDiffGet(botId, selected);
  }, [connected, botId, selected, diff, onWsDiffGet]);

  return { commits, selected, select: setPicked, diff, restore: (path: string) => { if (selected) api.onWsRestore(botId, selected, path); } };
}
