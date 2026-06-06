import { useCallback, useMemo, useRef, useState } from 'react';
import type { ClientMsg } from '../../shared/protocol';

export interface TermApi {
  attach: (id: string, cols: number, rows: number, onData: (d: string) => void, onExit: () => void, onReplay: (d: string) => void) => void;
  detach: (id: string) => void;
  input: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
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

export function useTerminals(send: (m: ClientMsg) => void): Terminals {
  const termData = useRef<Map<string, (d: string) => void>>(new Map());   // termId -> xterm.write
  const termReplay = useRef<Map<string, (d: string) => void>>(new Map()); // termId -> reset()+write (snapshot)
  const termExit = useRef<Map<string, () => void>>(new Map());
  const termDims = useRef<Map<string, { cols: number; rows: number }>>(new Map()); // p/ reattach no reconnect

  const attach = useCallback((id: string, cols: number, rows: number, onData: (d: string) => void, onExit: () => void, onReplay: (d: string) => void) => {
    termData.current.set(id, onData);
    termExit.current.set(id, onExit);
    termReplay.current.set(id, onReplay);
    termDims.current.set(id, { cols, rows });
    send({ t: 'term-open', termId: id, cols, rows });
  }, [send]);
  const detach = useCallback((id: string) => {
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
    termData.current.delete(id);
    termExit.current.delete(id);
    termReplay.current.delete(id);
    termDims.current.delete(id);
    send({ t: 'term-close', termId: id });
  }, [send]);
  const term: TermApi = useMemo(() => ({ attach, detach, input, resize, kill }), [attach, detach, input, resize, kill]);

  const [discovered, setDiscovered] = useState<string[]>([]);

  const onTermData = useCallback((id: string, data: string) => termData.current.get(id)?.(data), []);
  const onTermReplay = useCallback((id: string, data: string) => termReplay.current.get(id)?.(data), []);
  const onTermExit = useCallback((id: string) => termExit.current.get(id)?.(), []);
  const onTerms = useCallback((ids: string[]) => setDiscovered(ids), []);
  const listTerms = useCallback(() => send({ t: 'term-list' }), [send]);
  const reattach = useCallback(() => {
    for (const [id, d] of termDims.current) send({ t: 'term-open', termId: id, cols: d.cols, rows: d.rows });
  }, [send]);

  return { term, onTermData, onTermReplay, onTermExit, onTerms, discovered, listTerms, reattach };
}
