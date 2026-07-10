import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { setWss, BACKPRESSURE_BYTES } from './ws/broadcast';
import { CONFIG } from './config';
import { currentRole, roleFromToken } from './auth';
import { originAllowed } from './ws/origin';
import { tokenAllowed, tokenFromUrl } from './ws/token';
import { runStats, killAllRuns, fireCron } from './ws/runs';
import { startCronLoop } from './crons';
import { startStatsLoop } from './ws/stats-loop';
import { startPlanUsageLoop } from './ws/usage-plan';
import { startModelsLoop } from './ws/models';
import { probeSlashCommands } from './ws/slash-probe';
import { serveConnection } from './ws/serve-connection';
import { startSessionsWatch } from './sessions/watch';
import { startPointsWatch } from './points-watch';

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
      // Também termina socket OPEN-mas-entupido: entre dois pings (até 60s) um
      // cliente meio-morto acumularia frames de ciclo de vida (não-dropáveis:
      // started/tool/done/user) sem teto até OOM. O mesmo guard do dial mode
      // (agent.ts MAX_BUFFERED) faltava aqui no listen mode (#6 da auditoria).
      if (alive === false || c.bufferedAmount > BACKPRESSURE_BYTES) { c.terminate(); continue; }
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
    // sai do token: o checkpoint authorize() consulta ESTE role, não um constante.
    const role = CONFIG.authToken ? roleFromToken(CONFIG.authToken, tokenFromUrl(req.url)) : currentRole();
    // O ciclo de vida da conexão (bootstrap + loop + cleanup) é agnóstico ao
    // transporte — o mesmo serveConnection serve o agente T3 que disca pro relay.
    serveConnection(ws, { role });
  });

  const hasClients = () => wss.clients.size > 0;
  startStatsLoop(hasClients);
  startPlanUsageLoop(hasClients);
  startModelsLoop(hasClients);
  startSessionsWatch(hasClients);
  startPointsWatch(hasClients);
  probeSlashCommands();
  startCronLoop(fireCron); // agendador: dispara prompts agendados (turnos autônomos)
  return wss;
}
