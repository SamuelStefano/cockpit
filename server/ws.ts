import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ClientMsg } from '../shared/protocol';
import { sanitize } from './engine/claude';
import { collect } from './stats';
import { detachTerm } from './terminals';
import { send, setWss } from './ws/broadcast';
import { CONFIG } from './config';
import { currentRole, capsFor } from './auth';
import { originAllowed } from './ws/origin';
import { getSlashCommands } from './ws/slash';
import { getLastRate } from './ws/rate';
import { threads, runStats, killAllRuns } from './ws/runs';
import { handle } from './ws/dispatch';
import { handleTerm, type TermHandle } from './ws/terminal-handler';
import { startStatsLoop } from './ws/stats-loop';

export { runStats, killAllRuns } from './ws/runs';

export function attachWs(server: Server) {
  // maxPayload: rejeita frames gigantes no transporte ANTES de o ws alocar/
  // decodificar e o JSON.parse alocar de novo. O upload manda o arquivo inteiro
  // em base64 num frame só; o teto de 15MB do app só checa DEPOIS. 32MB cobre o
  // upload legítimo (15MB → ~20MB em base64) e corta o frame acidental de 100MB.
  const wss = new WebSocketServer({
    server, path: '/ws', maxPayload: 32 * 1024 * 1024,
    verifyClient: (info: { origin: string }) => originAllowed(info.origin),
  });
  setWss(wss);

  // Heartbeat ping/pong: um socket meio-aberto (laptop dormindo, sem FIN do TCP)
  // não dispara 'close' por horas — e o broadcast segue empurrando frames de
  // ciclo de vida pro buffer de um cliente morto até estourar a heap (o OOM da
  // madrugada). A varredura termina sockets sem pong dentro de um intervalo.
  const beat = setInterval(() => {
    for (const c of wss.clients) {
      const alive = (c as WebSocket & { isAlive?: boolean }).isAlive;
      if (alive === false) { c.terminate(); continue; }
      (c as WebSocket & { isAlive?: boolean }).isAlive = false;
      try { c.ping(); } catch { /* socket já indo embora */ }
    }
  }, 30_000);
  beat.unref();
  wss.on('close', () => clearInterval(beat));

  wss.on('connection', (ws) => {
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on('pong', () => { (ws as WebSocket & { isAlive?: boolean }).isAlive = true; });
    send(ws, { t: 'caps', caps: capsFor(currentRole(), CONFIG) });
    send(ws, { t: 'busy', keys: [...threads.keys()] });
    const slash = getSlashCommands();
    if (slash.length) send(ws, { t: 'slash-commands', items: slash });
    const rate = getLastRate();
    if (rate) send(ws, { t: 'rate', ...rate });
    // Reconnect mid-run (#10): replaya o snapshot acumulado SÓ pra ESTE socket,
    // pra a UI reconstruir o turno em voo. Os deltas seguintes chegam via
    // broadcast (não roubamos mais o stream das outras abas).
    for (const [key, thread] of threads) {
      send(ws, { t: 'replay', sessionKey: key, text: thread.text, thinking: thread.thinking, tools: thread.tools });
    }
    collect().then((stats) => send(ws, { t: 'stats', stats })).catch(() => {});

    // terminais anexados por ESTA conexão — pra desanexar no disconnect.
    const myTerms = new Map<string, TermHandle>();

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try {
        const parsed = JSON.parse(String(raw));
        if (!parsed || typeof parsed !== 'object') return; // frame não-objeto (null/string/número)
        msg = parsed as ClientMsg;
      } catch { return; }
      // handleTerm é síncrono e roda fora do .catch do handle — um frame de
      // terminal malformado que lançasse aqui viraria uncaughtException e
      // derrubaria o processo inteiro. O try isola o socket que mandou lixo.
      try {
        if (handleTerm(ws, msg, myTerms)) return;
      } catch (e) {
        send(ws, { t: 'error', message: sanitize(String((e as Error)?.message ?? e)) });
        return;
      }
      handle(ws, msg).catch((e) => send(ws, { t: 'error', message: sanitize(String(e?.message ?? e)) }));
    });

    ws.on('close', () => {
      for (const [id, h] of myTerms) detachTerm(id, h.onData, h.onExit);
      myTerms.clear();
    });
  });

  startStatsLoop(wss);
  return wss;
}
