import { useCallback, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg, WsCommit, WsConflict, WsDiffFile, WsRepoStatus } from '../../shared/protocol';

export type WsDiffData = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; files: WsDiffFile[] };

export interface AgentHistoryApi {
  wsLogs: Record<string, WsCommit[]>;
  wsDiffs: Record<string, WsDiffData>;
  wsStatus: WsRepoStatus | null;
  wsConflicts: WsConflict[];
  wsRepos: string[] | null;
  wsError: string | null;
  onWsLogGet: (botId: string) => void;
  onWsDiffGet: (botId: string, hash: string) => void;
  onWsRestore: (botId: string, hash: string, path: string) => void;
  onWsSync: () => void;
  onWsReposGet: () => void;
  onWsConnect: (repo: string) => void;
}

export const wsDiffKey = (botId: string, hash: string) => `${botId}:${hash}`;

export function useAgentHistory(send: (m: ClientMsg) => boolean): AgentHistoryApi & { onMsg: (msg: ServerMsg) => boolean } {
  const [wsLogs, setLogs] = useState<Record<string, WsCommit[]>>({});
  const [wsDiffs, setDiffs] = useState<Record<string, WsDiffData>>({});
  const [wsStatus, setStatus] = useState<WsRepoStatus | null>(null);
  const [wsConflicts, setConflicts] = useState<WsConflict[]>([]);
  const [wsRepos, setRepos] = useState<string[] | null>(null);
  const [wsError, setError] = useState<string | null>(null);
  const shown = useRef(new Set<string>());

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'team-ws-log':
        setLogs((p) => ({ ...p, [msg.botId]: msg.items }));
        setStatus(msg.status);
        return true;
      case 'team-ws-diff':
        setDiffs((p) => ({ ...p, [wsDiffKey(msg.botId, msg.hash)]: msg.error ? { status: 'error', error: msg.error } : { status: 'ok', files: msg.files } }));
        return true;
      case 'team-ws-restored':
        setError(msg.ok ? null : msg.error ?? 'não foi possível restaurar');
        if (msg.ok) send({ t: 'team-files-get', botId: msg.botId });
        return true;
      case 'team-ws-status':
        setStatus(msg.status);
        if (!msg.error) for (const botId of shown.current) send({ t: 'team-ws-log-get', botId });
        if (msg.conflicts) setConflicts(msg.conflicts);
        setError(msg.error ?? null);
        return true;
      case 'team-ws-repos':
        setRepos(msg.repos);
        setError(msg.error ?? null);
        return true;
      default:
        return false;
    }
  }, [send]);

  const onWsLogGet = useCallback((botId: string) => { shown.current.add(botId); send({ t: 'team-ws-log-get', botId }); }, [send]);
  const onWsDiffGet = useCallback((botId: string, hash: string) => {
    if (send({ t: 'team-ws-diff-get', botId, hash })) setDiffs((p) => ({ ...p, [wsDiffKey(botId, hash)]: { status: 'loading' } }));
  }, [send]);
  const onWsRestore = useCallback((botId: string, hash: string, path: string) => { send({ t: 'team-ws-restore', botId, hash, path }); }, [send]);
  const onWsSync = useCallback(() => { send({ t: 'team-ws-sync' }); }, [send]);
  const onWsReposGet = useCallback(() => { send({ t: 'team-ws-repos-get' }); }, [send]);
  const onWsConnect = useCallback((repo: string) => { send({ t: 'team-ws-connect', repo }); }, [send]);

  return { wsLogs, wsDiffs, wsStatus, wsConflicts, wsRepos, wsError, onWsLogGet, onWsDiffGet, onWsRestore, onWsSync, onWsReposGet, onWsConnect, onMsg };
}
