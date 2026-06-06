import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { openTerm, detachTerm, inputTerm, resizeTerm, closeTerm, listTerms } from '../terminals';
import { send } from './broadcast';

export type TermHandle = { onData: (d: string) => void; onExit: () => void };

// Terminais (síncrono): true se a msg foi de terminal e já tratada.
export function handleTerm(
  ws: WebSocket,
  msg: ClientMsg,
  myTerms: Map<string, TermHandle>,
): boolean {
  switch (msg.t) {
    case 'term-open': {
      if (myTerms.has(msg.termId)) return true; // já anexado nesta conexão
      const onData = (data: string) => send(ws, { t: 'term-data', termId: msg.termId, data });
      const onExit = () => { send(ws, { t: 'term-exit', termId: msg.termId }); myTerms.delete(msg.termId); };
      const onReplay = (data: string) => send(ws, { t: 'term-replay', termId: msg.termId, data });
      const ok = openTerm(msg.termId, msg.cols, msg.rows, onData, onExit, onReplay);
      if (ok) myTerms.set(msg.termId, { onData, onExit });
      else send(ws, { t: 'term-exit', termId: msg.termId });
      return true;
    }
    case 'term-list': { void listTerms().then((ids) => send(ws, { t: 'terms', ids })); return true; }
    case 'term-input': { inputTerm(msg.termId, msg.data); return true; }
    case 'term-resize': { resizeTerm(msg.termId, msg.cols, msg.rows); return true; }
    case 'term-detach': {
      const h = myTerms.get(msg.termId);
      if (h) { detachTerm(msg.termId, h.onData, h.onExit); myTerms.delete(msg.termId); }
      return true; // sessão tmux fica viva pra reattach
    }
    case 'term-close': {
      const h = myTerms.get(msg.termId);
      if (h) { detachTerm(msg.termId, h.onData, h.onExit); myTerms.delete(msg.termId); }
      closeTerm(msg.termId);
      return true;
    }
  }
  return false;
}
