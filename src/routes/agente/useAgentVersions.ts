import { useEffect, useState } from 'react';
import { wsDiffKey, type AgentHistoryApi } from '../../cockpit/useAgentHistory';

export function useAgentVersions(botId: string, api: AgentHistoryApi, connected: boolean, isAdmin: boolean) {
  const { onWsLogGet, onWsDiffGet, onWsSync } = api;
  const commits = api.wsLogs[botId];
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && commits?.some((c) => c.hash === picked) ? picked : commits?.[0]?.hash ?? null;

  useEffect(() => {
    if (!connected) return;
    if (isAdmin && api.wsStatus?.repo) onWsSync();
    onWsLogGet(botId);
  }, [connected, botId, isAdmin, api.wsStatus?.repo, onWsLogGet, onWsSync]);

  const diff = selected ? api.wsDiffs[wsDiffKey(botId, selected)] : undefined;
  useEffect(() => {
    if (connected && selected && !diff) onWsDiffGet(botId, selected);
  }, [connected, botId, selected, diff, onWsDiffGet]);

  return { commits, selected, select: setPicked, diff, restore: (path: string) => { if (selected) api.onWsRestore(botId, selected, path); } };
}
