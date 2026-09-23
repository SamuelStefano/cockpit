import { useCallback, useMemo, useRef, useState } from 'react';
import type { ClientMsg } from '../../shared/protocol';

export interface TermApi {
  attach: (id: string, cols: number, rows: number, onData: (d: string) => void, onExit: () => void, onReplay: (d: string) => void, watch?: string) => void;
  detach: (id: string) => void;
  input: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
  resume: (id: string, sessionId: string) => void;
}

export interface Terminals {
  term: TermApi;
  onTermData: (id: string, data: string) => void;
  onTermReplay: (id: string, data: string) => void;
  onTermExit: (id: string) => void;
  onTerms: (ids: string[]) => void;       // resposta do term-list (sessões tmux persistentes)
  discovered: string[];                    // ids de sessões tmux vivas no servidor
  listTerms: () => void;                   // pede a lista ao servidor
  reattach: () => void;                    // reabre cada termId vivo após reconnect do ws
}

// term-open shares the server's tight "heavy" bucket (burst 15, 8/s) with
// list/open/send. The canvas mounts up to 8 session windows plus its shells at
// once, and a reconnect reattaches all of them: spaced out, they never drain
// the bucket and no window is left blank on a "muitas requisições".
const OPEN_SPACING_MS = 180;

export function useTerminals(send: (m: ClientMsg) => void): Terminals {
  const openQueue = useRef<ClientMsg[]>([]);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendOpen = useCallback((m: ClientMsg) => {
    openQueue.current.push(m);
    if (openTimer.current) return;
    const pump = () => {
      const next = openQueue.current.shift();
      if (!next) { openTimer.current = null; return; }
      send(next);
      openTimer.current = setTimeout(pump, OPEN_SPACING_MS);
    };
    pump();
  }, [send]);
  const termData = useRef<Map<string, (d: string) => void>>(new Map());   // termId -> xterm.write
  const termReplay = useRef<Map<string, (d: string) => void>>(new Map()); // termId -> reset()+write (snapshot)
  const termExit = useRef<Map<string, () => void>>(new Map());
  const termDims = useRef<Map<string, { cols: number; rows: number; watch?: string }>>(new Map()); // p/ reattach no reconnect

  const attach = useCallback((id: string, cols: number, rows: number, onData: (d: string) => void, onExit: () => void, onReplay: (d: string) => void, watch?: string) => {
    termData.current.set(id, onData);
    termExit.current.set(id, onExit);
    termReplay.current.set(id, onReplay);
    termDims.current.set(id, { cols, rows, watch });
    sendOpen(watch ? { t: 'term-open', termId: id, cols, rows, watch } : { t: 'term-open', termId: id, cols, rows });
  }, [sendOpen]);
  // An open still waiting in the queue must not fire after its window is gone:
  // the server would attach a listener nobody on this side will ever read.
  const dropQueued = (id: string) => {
    openQueue.current = openQueue.current.filter((m) => !(m.t === 'term-open' && m.termId === id));
  };
  const detach = useCallback((id: string) => {
    dropQueued(id);
    termData.current.delete(id);
    termExit.current.delete(id);
    termReplay.current.delete(id);
    termDims.current.delete(id);
    send({ t: 'term-detach', termId: id });
  }, [send]);
  const input = useCallback((id: string, data: string) => send({ t: 'term-input', termId: id, data }), [send]);
  const resize = useCallback((id: string, cols: number, rows: number) => {
    const d = termDims.current.get(id);
    if (d) { d.cols = cols; d.rows = rows; }
    send({ t: 'term-resize', termId: id, cols, rows });
  }, [send]);
  const kill = useCallback((id: string) => {
    dropQueued(id);
    termData.current.delete(id);
    termExit.current.delete(id);
    termReplay.current.delete(id);
    termDims.current.delete(id);
    send({ t: 'term-close', termId: id });
  }, [send]);
  const resume = useCallback((id: string, sessionId: string) => send({ t: 'term-resume', termId: id, watch: sessionId }), [send]);
  const term: TermApi = useMemo(() => ({ attach, detach, input, resize, kill, resume }), [attach, detach, input, resize, kill, resume]);

  const [discovered, setDiscovered] = useState<string[]>([]);

  const onTermData = useCallback((id: string, data: string) => termData.current.get(id)?.(data), []);
  const onTermReplay = useCallback((id: string, data: string) => termReplay.current.get(id)?.(data), []);
  const onTermExit = useCallback((id: string) => termExit.current.get(id)?.(), []);
  const onTerms = useCallback((ids: string[]) => setDiscovered(ids), []);
  const listTerms = useCallback(() => send({ t: 'term-list' }), [send]);
  const reattach = useCallback(() => {
    for (const [id, d] of termDims.current) sendOpen(d.watch ? { t: 'term-open', termId: id, cols: d.cols, rows: d.rows, watch: d.watch } : { t: 'term-open', termId: id, cols: d.cols, rows: d.rows });
  }, [sendOpen]);

  return { term, onTermData, onTermReplay, onTermExit, onTerms, discovered, listTerms, reattach };
}
