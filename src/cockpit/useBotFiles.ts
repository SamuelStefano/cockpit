import { useCallback, useRef, useState } from 'react';
import type { BotFile, ClientMsg, ServerMsg } from '../../shared/protocol';

export type BotFileData =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ok'; mime: string; size: number; url: string; text?: string };

export interface BotFiles {
  botFiles: Record<string, BotFile[]>;
  botFileData: Record<string, BotFileData>;
  onBotFilesGet: (botId: string) => void;
  onBotFileGet: (botId: string, path: string, force?: boolean) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export const botFileKey = (botId: string, path: string) => `${botId}:${path}`;

// Image previews can be up to 10MB each: keep the most recent few only.
const MAX_CACHED = 24;

function decode(dataB64: string, mime: string, size: number): BotFileData {
  const url = `data:${mime};base64,${dataB64}`;
  if (!mime.startsWith('text/') && mime !== 'application/json') return { status: 'ok', mime, size, url };
  const bytes = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));
  return { status: 'ok', mime, size, url, text: new TextDecoder().decode(bytes) };
}

export function useBotFiles(send: (m: ClientMsg) => boolean): BotFiles {
  const [botFiles, setBotFiles] = useState<Record<string, BotFile[]>>({});
  const [botFileData, setBotFileData] = useState<Record<string, BotFileData>>({});
  const asked = useRef(new Set<string>());

  const put = useCallback((key: string, v: BotFileData) => {
    setBotFileData((prev) => {
      const next = { ...prev, [key]: v };
      const keys = Object.keys(next);
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHED))) { delete next[k]; asked.current.delete(k); }
      return next;
    });
  }, []);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t === 'team-files') {
      setBotFiles((prev) => ({ ...prev, [msg.botId]: msg.items }));
      return true;
    }
    if (msg.t === 'team-file') {
      const key = botFileKey(msg.botId, msg.path);
      if (msg.error || !msg.dataB64 || !msg.mime) put(key, { status: 'error', error: msg.error ?? 'arquivo indisponível' });
      else put(key, decode(msg.dataB64, msg.mime, msg.size ?? 0));
      return true;
    }
    return false;
  }, [put]);

  const onBotFilesGet = useCallback((botId: string) => { send({ t: 'team-files-get', botId }); }, [send]);
  const onBotFileGet = useCallback((botId: string, path: string, force = false) => {
    const key = botFileKey(botId, path);
    if (asked.current.has(key) && !force) return;
    if (!send({ t: 'team-file-get', botId, path })) return;
    asked.current.add(key);
    put(key, { status: 'loading' });
  }, [send, put]);

  return { botFiles, botFileData, onBotFilesGet, onBotFileGet, onMsg };
}
