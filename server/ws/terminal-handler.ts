import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { openTerm, detachTerm, inputTerm, resizeTerm, closeTerm, listTerms, resumeTerm, ensureWatchReaper, prepareWatch, termSnapshot } from '../terminals';
import { send, BACKPRESSURE_BYTES } from './broadcast';

const pendingOpens = new WeakMap<WebSocket, Set<string>>();
function pendingOf(ws: WebSocket): Set<string> {
  let set = pendingOpens.get(ws);
  if (!set) { set = new Set(); pendingOpens.set(ws, set); }
  return set;
}

// opens: shared mode only — how many tab-level opens hold this listener.
export type TermHandle = { onData: (d: string) => void; onExit: () => void; opens?: number };

// Terminais (síncrono): true se a msg foi de terminal e já tratada.
// shared: dial mode (relay agent). Every tab of the account arrives on this ONE
// socket, so `myTerms` is shared by all of them: a tab reattaching (JWT refresh,
// phone wake, F5) finds the id already attached, and one tab's `term-detach`
// would remove the listener every other tab is reading through.
export function handleTerm(
  ws: WebSocket,
  msg: ClientMsg,
  myTerms: Map<string, TermHandle>,
  shared = false,
): boolean {
  switch (msg.t) {
    case 'term-open': {
      const termId = msg.termId;
      const pending = pendingOf(ws);
      if (pending.has(termId)) return true;
      if (myTerms.has(termId)) {
        // Already attached on this connection. Shared: it is another (or a
        // reconnecting) tab, which still needs the screen repainted (output from the
        // gap, full-screen TUIs). A per-tab socket reopening is just a no-op.
        if (!shared) return true;
        const h = myTerms.get(termId)!;
        h.opens = (h.opens ?? 1) + 1;
        const snap = termSnapshot(termId);
        if (snap) send(ws, { t: 'term-replay', termId, data: snap });
        return true;
      }
      const watch = typeof msg.watch === 'string' ? msg.watch : undefined;
      const { cols, rows } = msg;
      const attach = () => {
        // Backpressure: term-data é alta-frequência e reconstruível (tmux repinta no
        // reattach). Num socket lento (celular em wifi ruim) o buffer do ws cresce sem
        // freio até estourar a heap. Acima do teto, dropa pra ESTE socket — uma lacuna
        // momentânea na tela é preferível ao OOM; o scrollback volta no próximo replay.
        const onData = (data: string) => {
          if (ws.bufferedAmount > BACKPRESSURE_BYTES) return;
          send(ws, { t: 'term-data', termId, data });
        };
        const onExit = () => { send(ws, { t: 'term-exit', termId }); myTerms.delete(termId); };
        const onReplay = (data: string) => send(ws, { t: 'term-replay', termId, data });
        const ok = openTerm(termId, cols, rows, onData, onExit, onReplay, watch);
        if (ok) myTerms.set(termId, { onData, onExit });
        else send(ws, { t: 'term-exit', termId });
      };
      if (!watch) { attach(); return true; }
      // A watch pane may first need its bare shell swapped for the follower; a
      // detach or a closed socket while that runs cancels the attach.
      pending.add(termId);
      void prepareWatch(termId, watch).catch(() => {}).then(() => {
        if (!pending.delete(termId) || ws.readyState !== ws.OPEN) return;
        // Outside serve-connection's try: a forkpty failure here would be an
        // unhandledRejection, which shuts the whole backend down.
        try { attach(); } catch { send(ws, { t: 'term-exit', termId }); }
      });
      return true;
    }
    case 'term-list': {
      ensureWatchReaper(); // sweeps watchers orphaned by a previous backend too
      void listTerms().then((ids) => send(ws, { t: 'terms', ids }));
      return true;
    }
    case 'term-resume': {
      if (typeof msg.termId !== 'string' || typeof msg.watch !== 'string') return true;
      // Said inside the terminal itself: a keyless `error` frame only surfaces
      // when the tab is hidden. Written to this socket only, never into tmux.
      const termId = msg.termId;
      void resumeTerm(termId, msg.watch).then((ok) => {
        if (!ok) send(ws, { t: 'term-data', termId, data: '\r\n\x1b[33m[retomar recusado: o terminal já saiu do acompanhamento — rode claude --resume à mão]\x1b[0m\r\n' });
      });
      return true;
    }
    case 'term-input': {
      // Cap de tamanho: um frame de 32MB (teto do transporte) escrito cru no PTY
      // é pressão de memória/CPU sem freio. Digitação/paste humanos cabem em 64KB.
      if (typeof msg.data === 'string' && msg.data.length <= 65536) inputTerm(msg.termId, msg.data);
      return true;
    }
    case 'term-resize': { resizeTerm(msg.termId, msg.cols, msg.rows); return true; }
    case 'term-detach': {
      // Shared socket: other tabs may still be watching. Each tab-level open counts;
      // the listener goes only when the last one detaches (a tab that reconnected
      // without detaching over-counts, and `no-browsers` releases everything once
      // the last tab is gone — see serve-connection).
      if (shared) {
        const h = myTerms.get(msg.termId);
        if (h && (h.opens ?? 1) > 1) { h.opens = (h.opens ?? 1) - 1; return true; }
      }
      pendingOf(ws).delete(msg.termId);
      const h = myTerms.get(msg.termId);
      if (h) { detachTerm(msg.termId, h.onData, h.onExit); myTerms.delete(msg.termId); }
      return true; // sessão tmux fica viva pra reattach
    }
    case 'term-close': {
      pendingOf(ws).delete(msg.termId);
      const h = myTerms.get(msg.termId);
      if (h) { detachTerm(msg.termId, h.onData, h.onExit); myTerms.delete(msg.termId); }
      closeTerm(msg.termId);
      return true;
    }
  }
  return false;
}
