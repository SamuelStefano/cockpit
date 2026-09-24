import { useCallback, useMemo, useRef, useState } from 'react';
import type { ClientMsg } from '../../shared/protocol';

export interface TermApi {
  attach: (id: string, cols: number, rows: number, onData: (d: string) => void, onExit: () => void, onReplay: (d: string) => void, watch?: string) => void;
  detach: (id: string) => void;
  // false = the socket was not open and nothing was sent.
  input: (id: string, data: string) => boolean;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
  resume: (id: string, sessionId: string) => void;
  // Terminals whose process exited since they were opened (the tab stays, dead).
  exited: ReadonlySet<string>;
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

export function useTerminals(send: (m: ClientMsg) => boolean): Terminals {
  // Ids, not frames: an open waits up to OPEN_SPACING_MS per window ahead of it,
  // and the first fit's resize lands meanwhile. Building the frame at send time
  // opens the pty at the fitted size instead of xterm's default 80x24.
  const openQueue = useRef<string[]>([]);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termDims = useRef<Map<string, { cols: number; rows: number; watch?: string }>>(new Map()); // p/ reattach no reconnect
  // Last size the server heard per id: ResizeObserver fires every frame while a
  // window is dragged, and identical resizes ate the connection's rate budget.
  const sentDims = useRef<Map<string, string>>(new Map());
  const sendOpen = useCallback((id: string) => {
    if (!openQueue.current.includes(id)) openQueue.current.push(id);
    if (openTimer.current) return;
    const pump = () => {
      for (let next = openQueue.current.shift(); next !== undefined; next = openQueue.current.shift()) {
        const d = termDims.current.get(next);
        if (!d) continue;
        send(d.watch ? { t: 'term-open', termId: next, cols: d.cols, rows: d.rows, watch: d.watch } : { t: 'term-open', termId: next, cols: d.cols, rows: d.rows });
        sentDims.current.set(next, `${d.cols}x${d.rows}`);
        openTimer.current = setTimeout(pump, OPEN_SPACING_MS);
        return;
      }
      openTimer.current = null;
    };
    pump();
  }, [send]);
  const termData = useRef<Map<string, (d: string) => void>>(new Map());   // termId -> xterm.write
  const termReplay = useRef<Map<string, (d: string) => void>>(new Map()); // termId -> reset()+write (snapshot)
  const termExit = useRef<Map<string, () => void>>(new Map());

  const [exited, setExited] = useState<ReadonlySet<string>>(() => new Set());
  const markAlive = (id: string) => setExited((s) => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; });
  const attach = useCallback((id: string, cols: number, rows: number, onData: (d: string) => void, onExit: () => void, onReplay: (d: string) => void, watch?: string) => {
    markAlive(id);
    termData.current.set(id, onData);
    termExit.current.set(id, onExit);
    termReplay.current.set(id, onReplay);
    termDims.current.set(id, { cols, rows, watch });
    sentDims.current.delete(id);
    sendOpen(id);
  }, [sendOpen]);
  // An open still waiting in the queue must not fire after its window is gone:
  // the server would attach a listener nobody on this side will ever read.
  const dropQueued = (id: string) => {
    openQueue.current = openQueue.current.filter((q) => q !== id);
    sentDims.current.delete(id);
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
    // Still queued: the open will carry these dims.
    if (openQueue.current.includes(id)) return;
    const key = `${cols}x${rows}`;
    if (sentDims.current.get(id) === key) return;
    sentDims.current.set(id, key);
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
  const term: TermApi = useMemo(() => ({ attach, detach, input, resize, kill, resume, exited }), [attach, detach, input, resize, kill, resume, exited]);

  const [discovered, setDiscovered] = useState<string[]>([]);

  const onTermData = useCallback((id: string, data: string) => termData.current.get(id)?.(data), []);
  const onTermReplay = useCallback((id: string, data: string) => termReplay.current.get(id)?.(data), []);
  const onTermExit = useCallback((id: string) => {
    setExited((s) => (s.has(id) ? s : new Set(s).add(id)));
    termExit.current.get(id)?.();
  }, []);
  const onTerms = useCallback((ids: string[]) => setDiscovered(ids), []);
  const listTerms = useCallback(() => send({ t: 'term-list' }), [send]);
  const reattach = useCallback(() => {
    for (const id of termDims.current.keys()) sendOpen(id);
  }, [sendOpen]);

  return { term, onTermData, onTermReplay, onTermExit, onTerms, discovered, listTerms, reattach };
}
