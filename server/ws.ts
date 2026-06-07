import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ClientMsg } from '../shared/protocol';
import { sanitize } from './engine/claude';
import { collect } from './stats';
import { detachTerm } from './terminals';
import { send, setWss } from './ws/broadcast';
import { CONFIG } from './config';
import { currentRole, roleFromToken, capsFor } from './auth';
import { originAllowed } from './ws/origin';
import { tokenAllowed, tokenFromUrl } from './ws/token';
import { authorize } from './ws/authz';
import { getSlashCommands } from './ws/slash';
import { getLastRate } from './ws/rate';
import { threads, runStats, killAllRuns } from './ws/runs';
import { handle } from './ws/dispatch';
import { handleTerm, type TermHandle } from './ws/terminal-handler';
import { createRateLimiter } from './ws/guard';
import { startStatsLoop } from './ws/stats-loop';
import { getLastPlanUsage, startPlanUsageLoop } from './ws/usage-plan';
import { getLastModels, startModelsLoop } from './ws/models';
import { probeSlashCommands } from './ws/slash-probe';

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

  wss.on('connection', (ws, req) => {
    // Gate de auth ANTES de qualquer trabalho ou estado por-conexão (DR-011 Fase
    // 2). verifyClient já barrou origem cruzada; aqui exigimos o token quando
    // configurado. Fechamos com 4401 (código de app) pra a UI distinguir
    // "token errado" de "backend caiu" e mostrar o login em vez de re-tentar.
    if (!tokenAllowed(CONFIG.authToken, tokenFromUrl(req.url))) {
      try { ws.close(4401, 'auth'); } catch { /* socket já indo embora */ }
      return;
    }
    // Papel fixado por-conexão a partir do token (DR-011 Fase 2 / DR-014). Sem
    // token configurado = loopback single-user → admin (currentRole). Com token,
    // sai do token: o checkpoint authorize() abaixo consulta ESTE role, não um
    // constante. Inerte hoje (token único → admin); arma o corte pro student.
    const role = CONFIG.authToken ? roleFromToken(CONFIG.authToken, tokenFromUrl(req.url)) : currentRole();
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on('pong', () => { (ws as WebSocket & { isAlive?: boolean }).isAlive = true; });
    send(ws, { t: 'caps', caps: capsFor(role, CONFIG) });
    send(ws, { t: 'busy', keys: [...threads.keys()] });
    const slash = getSlashCommands();
    if (slash.length) send(ws, { t: 'slash-commands', items: slash });
    const rate = getLastRate();
    if (rate) send(ws, { t: 'rate', ...rate });
    const planUsage = getLastPlanUsage();
    if (planUsage) send(ws, { t: 'plan-usage', usage: planUsage });
    const models = getLastModels();
    if (models.length) send(ws, { t: 'models', models });
    // Reconnect mid-run (#10): replaya o snapshot acumulado SÓ pra ESTE socket,
    // pra a UI reconstruir o turno em voo. Os deltas seguintes chegam via
    // broadcast (não roubamos mais o stream das outras abas).
    for (const [key, thread] of threads) {
      send(ws, { t: 'replay', sessionKey: key, text: thread.text, thinking: thread.thinking, tools: thread.tools });
    }
    collect().then((stats) => send(ws, { t: 'stats', stats })).catch(() => {});

    // terminais anexados por ESTA conexão — pra desanexar no disconnect.
    const myTerms = new Map<string, TermHandle>();
    const limiter = createRateLimiter();

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try {
        const parsed = JSON.parse(String(raw));
        if (!parsed || typeof parsed !== 'object') return; // frame não-objeto (null/string/número)
        msg = parsed as ClientMsg;
      } catch { return; }
      if (typeof msg.t !== 'string') return;
      // Teto por conexão antes de qualquer trabalho: corta loop de frames (DoS).
      if (!limiter.allow(msg.t)) { send(ws, { t: 'error', message: 'muitas requisições' }); return; }
      // Checkpoint ÚNICO de autorização (default-deny), ANTES do handleTerm (que
      // trata term-* e retorna) e do dispatch/startRun. Uma só fonte de verdade:
      // a allowlist por papel em authz.ts. Inerte hoje (role admin recebe tudo);
      // corta shell/admin/mutação alheia pro student quando o token trouxer role.
      if (!authorize(role, msg.t)) {
        send(ws, { t: 'error', message: 'sem permissão' });
        return;
      }
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
  startPlanUsageLoop(wss);
  startModelsLoop(wss);
  probeSlashCommands();
  return wss;
}
