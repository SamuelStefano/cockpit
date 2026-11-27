import { useCallback, useRef, useState } from 'react';
import type { ClientMsg, DflPointsSnapshot, PointsEntry, ServerMsg } from '../../shared/protocol';
import type { DflDraft, DraftOp } from '../../shared/dfl-drafts';

export interface DflWriteResult { ok: boolean; message?: string; taskId?: string }

export interface DflChange {
  taskId: string; taskName: string; currentPoints: number; newPoints: number; reason?: string;
}

export interface DflInvoice {
  deliveryId: string; deliveryName: string;
  projectId?: string | null; projectName?: string | null;
  referenceMonth: string; pricePerPoint: number;
  tasks: { id: string; title: string; points: number }[];
}

export interface PontosAgentTasks {
  note: string; epicCapCents: number; monthCapCents: number; pointValue: number; target?: 'dfl' | 'drafts';
}

export interface Points {
  points: PointsEntry[];
  pointsTotal: number;
  pointsLoaded: boolean;
  dflSnapshot: DflPointsSnapshot | null;
  dflLoaded: boolean;
  dflSyncing: boolean;
  drafts: DflDraft[];
  draftsLoaded: boolean;
  onPointsGet: () => void;
  // Devolvem se o frame saiu: com o socket fechado o envio é descartado em silêncio
  // e a rota não pode confirmar a escrita.
  onPointsAdd: (title: string, pts: number, description?: string) => boolean;
  onPointsCorrect: (entryId: string, pts: number) => boolean;
  onPointsNote: (entryId: string, description: string) => boolean;
  onPointsDelete: (entryId: string) => boolean;
  onDflGet: () => void;
  onDflSync: () => void;
  onDflChange: (p: DflChange) => Promise<DflWriteResult>;
  onDflInvoice: (p: DflInvoice) => Promise<DflWriteResult>;
  onPontosAgent: (p: PontosAgentTasks) => Promise<DflWriteResult>;
  // Kanban<->DFL card link (Canvas' CardEditor). Same request/response shape
  // as onDflChange/onDflInvoice (reqId casado via dflWrite); onDflTaskUnlink
  // has no server ack to wait on — it's always local-only. onDflTaskConfirmSync
  // is the ONLY path that pushes a review/done status for real (server
  // requires a human action for those, never automatic — see
  // statusNeedsHumanConfirm/shared/canvas.ts).
  onDflTaskLink: (cardId: string, taskId: string) => Promise<DflWriteResult>;
  onDflTaskCreateLink: (cardId: string, taskName: string, epicId: string, deliveryId: string, why: string, what: string) => Promise<DflWriteResult>;
  onDflTaskUnlink: (cardId: string) => boolean;
  onDflTaskConfirmSync: (cardId: string) => Promise<DflWriteResult>;
  onDraftsGet: () => void;
  onDraftOp: (op: DraftOp) => boolean;
  onMsg: (msg: ServerMsg) => boolean;
}

const WRITE_TIMEOUT_MS = 65_000;

export function usePoints(send: (m: ClientMsg) => boolean): Points {
  const [points, setPoints] = useState<PointsEntry[]>([]);
  const [pointsTotal, setPointsTotal] = useState(0);
  const [pointsLoaded, setPointsLoaded] = useState(false);
  const [dflSnapshot, setDflSnapshot] = useState<DflPointsSnapshot | null>(null);
  const [dflLoaded, setDflLoaded] = useState(false);
  const [dflSyncing, setDflSyncing] = useState(false);
  const [drafts, setDrafts] = useState<DflDraft[]>([]);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  // Escritas DFL (mudar pontos / gerar fatura): request→response casado por reqId.
  // O modal chama onDflChange/onDflInvoice e aguarda a Promise; o servidor responde
  // com points-dfl-write e resolvemos o resolver pendente.
  const writeResolvers = useRef<Map<string, (r: DflWriteResult) => void>>(new Map());

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'points':
        setPoints(msg.entries);
        setPointsTotal(msg.total);
        setPointsLoaded(true);
        return true;
      case 'points-dfl':
        setDflSnapshot(msg.snapshot);
        setDflLoaded(true);
        setDflSyncing(false);
        return true;
      case 'points-dfl-syncing':
        setDflSyncing(true);
        return true;
      case 'drafts':
        setDrafts(msg.items);
        setDraftsLoaded(true);
        return true;
      case 'points-dfl-write': {
        const resolve = writeResolvers.current.get(msg.reqId);
        if (resolve) { writeResolvers.current.delete(msg.reqId); resolve({ ok: msg.ok, message: msg.message }); }
        return true;
      }
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
    points,
    pointsTotal,
    pointsLoaded,
    dflSnapshot,
    dflLoaded,
    dflSyncing,
    drafts,
    draftsLoaded,
    onPointsGet: useCallback(() => { send({ t: 'points-get' }); }, [send]),
    onPointsAdd: useCallback((title: string, pts: number, description?: string) => send({ t: 'points-add', title, points: pts, description }), [send]),
    onPointsCorrect: useCallback((entryId: string, pts: number) => send({ t: 'points-correct', entryId, points: pts }), [send]),
    onPointsNote: useCallback((entryId: string, description: string) => send({ t: 'points-note', entryId, description }), [send]),
    onPointsDelete: useCallback((entryId: string) => send({ t: 'points-delete', entryId }), [send]),
    onDflGet: useCallback(() => { send({ t: 'points-dfl-get' }); }, [send]),
    onDflSync: useCallback(() => { send({ t: 'points-dfl-sync' }); }, [send]),
    onDflChange: useCallback((p: DflChange) => {
      const reqId = crypto.randomUUID();
      return dflWrite({ t: 'points-dfl-change', reqId, ...p }, reqId);
    }, [dflWrite]),
    onDflInvoice: useCallback((p: DflInvoice) => {
      const reqId = crypto.randomUUID();
      return dflWrite({ t: 'points-dfl-invoice', reqId, ...p }, reqId);
    }, [dflWrite]),
    // O servidor responde assim que o turno ARRANCA (não quando termina): a
    // promessa é "agente disparado", e o trabalho dele aparece na sessão.
    onPontosAgent: useCallback((p: PontosAgentTasks) => {
      const reqId = crypto.randomUUID();
      return dflWrite({ t: 'pontos-agent-tasks', reqId, ...p }, reqId);
    }, [dflWrite]),
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
    onDraftsGet: useCallback(() => { send({ t: 'drafts-get' }); }, [send]),
    onDraftOp: useCallback((op: DraftOp) => send({ t: 'drafts-op', op }), [send]),
    onMsg,
  };
}
