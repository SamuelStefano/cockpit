import { useEffect, useMemo, useState } from 'react';
import { botFileKey } from '../../cockpit/useBotFiles';
import type { BotFilesApi } from './equipe-props';
import { groupFilesByAge } from './file-groups';

export function useBotFilesTab(botId: string, api: BotFilesApi, connected: boolean) {
  const { botFiles, botFileData, onBotFilesGet, onBotFileGet } = api;
  const [openPath, setOpenPath] = useState<string | null>(null);
  useEffect(() => { setOpenPath(null); }, [botId]);
  useEffect(() => { if (connected) onBotFilesGet(botId); }, [botId, connected, onBotFilesGet]);
  const items = botFiles[botId];
  const groups = useMemo(() => groupFilesByAge(items ?? [], Date.now()), [items]);
  const open = (path: string) => {
    setOpenPath(path);
    // Always re-read: the bot may have rewritten the file since the last preview.
    onBotFileGet(botId, path, true);
  };
  return {
    loaded: items !== undefined,
    groups,
    openPath,
    openData: openPath ? botFileData[botFileKey(botId, openPath)] : undefined,
    open,
    close: () => setOpenPath(null),
    refresh: () => onBotFilesGet(botId),
  };
}
