import { useCallback, useRef, useState } from 'react';
import type { ClientMsg, DflPointsSnapshot, PointsEntry, ServerMsg } from '../../shared/protocol';

export interface DflWriteResult { ok: boolean; message?: string }

export interface DflChange {
  taskId: string; taskName: string; currentPoints: number; newPoints: number; reason?: string;
}

export interface DflInvoice {
  deliveryId: string; deliveryName: string;
  projectId?: string | null; projectName?: string | null;
  referenceMonth: string; pricePerPoint: number;
  tasks: { id: string; title: string; points: number }[];
}

export interface Points {
  points: PointsEntry[];
  pointsTotal: number;
  pointsLoaded: boolean;
  dflSnapshot: DflPointsSnapshot | null;
  dflLoaded: boolean;
  dflSyncing: boolean;
  onPointsGet: () => void;
  onPointsAdd: (title: string, pts: number, description?: string) => void;
  onPointsCorrect: (entryId: string, pts: number) => void;
  onPointsNote: (entryId: string, description: string) => void;
  onPointsDelete: (entryId: string) => void;
  onDflGet: () => void;
  onDflSync: () => void;
  onDflChange: (p: DflChange) => Promise<DflWriteResult>;
  onDflInvoice: (p: DflInvoice) => Promise<DflWriteResult>;
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
      case 'points-dfl-write': {
        const resolve = writeResolvers.current.get(msg.reqId);
        if (resolve) { writeResolvers.current.delete(msg.reqId); resolve({ ok: msg.ok, message: msg.message }); }
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
    onPointsGet: useCallback(() => { send({ t: 'points-get' }); }, [send]),
    onPointsAdd: useCallback((title: string, pts: number, description?: string) => { send({ t: 'points-add', title, points: pts, description }); }, [send]),
    onPointsCorrect: useCallback((entryId: string, pts: number) => { send({ t: 'points-correct', entryId, points: pts }); }, [send]),
    onPointsNote: useCallback((entryId: string, description: string) => { send({ t: 'points-note', entryId, description }); }, [send]),
    onPointsDelete: useCallback((entryId: string) => { send({ t: 'points-delete', entryId }); }, [send]),
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
    onMsg,
  };
}
