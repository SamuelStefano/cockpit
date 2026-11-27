import { useCallback, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { decode, type BotFileData } from './useBotFiles';

export type SessionFileData = BotFileData;

export interface SessionFiles {
  sessionFileData: Record<string, SessionFileData>;
  onSessionFileGet: (sessionId: string, path: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export const sessionFileKey = (sessionId: string, path: string) => `${sessionId}:${path}`;

// An image can be 10MB as a data URL: keep the most recent few only.
const MAX_CACHED = 12;
// A request the socket dropped never answers: after this it may be asked again.
const PENDING_MS = 10_000;

export function useSessionFiles(send: (m: ClientMsg) => boolean, now: () => number = Date.now): SessionFiles {
  const [sessionFileData, setData] = useState<Record<string, SessionFileData>>({});
  const pending = useRef(new Map<string, number>());

  const put = useCallback((key: string, v: SessionFileData) => {
    setData((prev) => {
      // Re-inserted last: the file on screen is never the one evicted.
      const { [key]: _old, ...rest } = prev;
      const next: Record<string, SessionFileData> = { ...rest, [key]: v };
      const keys = Object.keys(next);
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHED))) delete next[k];
      return next;
    });
  }, []);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'session-file') return false;
    const key = sessionFileKey(msg.sessionId, msg.path);
    pending.current.delete(key);
    // An empty file is a valid answer: only a missing payload is an error.
    if (msg.error || msg.dataB64 === undefined || !msg.mime) put(key, { status: 'error', error: msg.error ?? 'arquivo indisponível' });
    else put(key, { ...decode(msg.dataB64, msg.mime, msg.size ?? 0), ...(msg.truncated ? { truncated: true } : {}) } as SessionFileData);
    return true;
  }, [put]);

  // Every open asks again: the agent edits these files while the chat runs. A
  // copy already shown stays on screen until the fresh one lands.
  const onSessionFileGet = useCallback((sessionId: string, path: string) => {
    const key = sessionFileKey(sessionId, path);
    const t = pending.current.get(key);
    if (t !== undefined && now() - t < PENDING_MS) return;
    if (!send({ t: 'session-file-get', sessionId, path })) return;
    pending.current.set(key, now());
    setData((prev) => (prev[key]?.status === 'ok' ? prev : { ...prev, [key]: { status: 'loading' } }));
  }, [send, now]);

  return { sessionFileData, onSessionFileGet, onMsg };
}
