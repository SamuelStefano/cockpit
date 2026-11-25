import { useCallback, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { decode, MAX_CACHED, type BotFileData } from './useBotFiles';

export type SessionFileData = BotFileData;

export interface SessionFiles {
  sessionFileData: Record<string, SessionFileData>;
  onSessionFileGet: (sessionId: string, path: string, force?: boolean) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export const sessionFileKey = (sessionId: string, path: string) => `${sessionId}:${path}`;

export function useSessionFiles(send: (m: ClientMsg) => boolean): SessionFiles {
  const [sessionFileData, setData] = useState<Record<string, SessionFileData>>({});
  const asked = useRef(new Set<string>());

  const put = useCallback((key: string, v: SessionFileData) => {
    setData((prev) => {
      const next = { ...prev, [key]: v };
      const keys = Object.keys(next);
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHED))) { delete next[k]; asked.current.delete(k); }
      return next;
    });
  }, []);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'session-file') return false;
    const key = sessionFileKey(msg.sessionId, msg.path);
    if (msg.error || !msg.dataB64 || !msg.mime) put(key, { status: 'error', error: msg.error ?? 'arquivo indisponível' });
    else put(key, decode(msg.dataB64, msg.mime, msg.size ?? 0));
    return true;
  }, [put]);

  const onSessionFileGet = useCallback((sessionId: string, path: string, force = false) => {
    const key = sessionFileKey(sessionId, path);
    if (asked.current.has(key) && !force) return;
    if (!send({ t: 'session-file-get', sessionId, path })) return;
    asked.current.add(key);
    put(key, { status: 'loading' });
  }, [send, put]);

  return { sessionFileData, onSessionFileGet, onMsg };
}
