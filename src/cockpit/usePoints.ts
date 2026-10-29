import { useCallback, useRef, useState } from 'react';
import type { ClientMsg, DflPointsSnapshot, ServerMsg } from '../../shared/protocol';

export interface DflWriteResult { ok: boolean; message?: string; taskId?: string }

export interface Points {
  dflSnapshot: DflPointsSnapshot | null;
  dflLoaded: boolean;
  dflSyncing: boolean;
  onDflGet: () => void;
  onDflSync: () => void;
  // Kanban<->DFL card link (Canvas' CardEditor). Same request/response shape
  // as a request/response pair (reqId matched via dflWrite); onDflTaskUnlink
  // has no server ack to wait on — it's always local-only. onDflTaskConfirmSync
  // is the ONLY path that pushes a review/done status for real (server
  // requires a human action for those, never automatic — see
  // statusNeedsHumanConfirm/shared/canvas.ts).
  onDflTaskLink: (cardId: string, taskId: string) => Promise<DflWriteResult>;
  onDflTaskCreateLink: (cardId: string, taskName: string, epicId: string, deliveryId: string, why: string, what: string) => Promise<DflWriteResult>;
  onDflTaskUnlink: (cardId: string) => boolean;
  onDflTaskConfirmSync: (cardId: string) => Promise<DflWriteResult>;
  onMsg: (msg: ServerMsg) => boolean;
}

const WRITE_TIMEOUT_MS = 65_000;

export function usePoints(send: (m: ClientMsg) => boolean): Points {
  const [dflSnapshot, setDflSnapshot] = useState<DflPointsSnapshot | null>(null);
  const [dflLoaded, setDflLoaded] = useState(false);
  const [dflSyncing, setDflSyncing] = useState(false);
  // DFL task writes (link/create/confirm): request→response matched by reqId.
  const writeResolvers = useRef<Map<string, (r: DflWriteResult) => void>>(new Map());

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'points-dfl':
        setDflSnapshot(msg.snapshot);
        setDflLoaded(true);
        setDflSyncing(false);
        return true;
      case 'points-dfl-syncing':
        setDflSyncing(true);
        return true;
      case 'dfl-task-write': {
        const resolve = writeResolvers.current.get(msg.reqId);
        if (resolve) { writeResolvers.current.delete(msg.reqId); resolve({ ok: msg.ok, message: msg.message, taskId: msg.taskId }); }
        return true;
      }
      default:
        return false;
    }
  }, []);

  const dflWrite = useCallback((m: ClientMsg, reqId: string): Promise<DflWriteResult> =>
    new Promise((resolve) => {
      writeResolvers.current.set(reqId, resolve);
      if (!send(m)) { writeResolvers.current.delete(reqId); resolve({ ok: false, message: 'sem conexão com o backend' }); return; }
      setTimeout(() => {
        if (writeResolvers.current.has(reqId)) { writeResolvers.current.delete(reqId); resolve({ ok: false, message: 'tempo esgotado' }); }
      }, WRITE_TIMEOUT_MS);
    }), [send]);

  return {
    dflSnapshot,
    dflLoaded,
    dflSyncing,
    onDflGet: useCallback(() => { send({ t: 'points-dfl-get' }); }, [send]),
    onDflSync: useCallback(() => { send({ t: 'points-dfl-sync' }); }, [send]),
    // `confirm: true` literal, always — the UI only calls this from the
    // reviewed confirm step (DflLinkSection); there is no path that sends
    // false/omitted, matching the server's hard requirement for it.
    onDflTaskLink: useCallback((cardId: string, taskId: string) => {
      const reqId = crypto.randomUUID();
      return dflWrite({ t: 'dfl-task-link', reqId, cardId, taskId, confirm: true }, reqId);
    }, [dflWrite]),
    onDflTaskCreateLink: useCallback((cardId: string, taskName: string, epicId: string, deliveryId: string, why: string, what: string) => {
      const reqId = crypto.randomUUID();
      return dflWrite({ t: 'dfl-task-create-link', reqId, cardId, taskName, epicId, deliveryId, why, what, confirm: true }, reqId);
    }, [dflWrite]),
    onDflTaskUnlink: useCallback((cardId: string) => send({ t: 'dfl-task-unlink', cardId }), [send]),
    onDflTaskConfirmSync: useCallback((cardId: string) => {
      const reqId = crypto.randomUUID();
      return dflWrite({ t: 'dfl-task-confirm-sync', reqId, cardId }, reqId);
    }, [dflWrite]),
    onMsg,
  };
}
