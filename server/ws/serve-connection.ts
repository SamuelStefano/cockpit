import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import type { Role } from '../auth';
import { sanitize } from '../engine/claude';
import { collect } from '../stats';
import { detachTerm } from '../terminals';
import { send } from './broadcast';
import { CONFIG } from '../config';
import { capsFor } from '../auth';
import { claudeReady, mcpServerDefsSync } from '../admin-ops';
import { getSlashCommands } from './slash';
import { getLastRate } from './rate';
import { threads } from './runs';
import { handle } from './dispatch';
import { handleTerm, type TermHandle } from './terminal-handler';
import { createRateLimiter } from './guard';
import { getLastPlanUsage, requestPlanUsageRefresh } from './usage-plan';
import { getLastModels } from './models';
import { authorize } from './authz';

// Ciclo de vida de UMA conexão WS, independente do transporte. No modo listen
// (app de hoje) o attachWs chama isto por socket aceito; no modo dial (agente T3)
// o agent.ts chama isto sobre o socket que discou pro relay. O role já vem
// resolvido (token no listen; dono-da-box no agente) — aqui é só servir o
// protocolo: bootstrap (caps/busy/replay/…), o loop de mensagens com o checkpoint
// authorize, e o cleanup de terminais no close.
export function serveConnection(ws: WebSocket, opts: { role: Role; sendCaps?: boolean }) {
  const { role, sendCaps = true } = opts;
  (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
  ws.on('pong', () => { (ws as WebSocket & { isAlive?: boolean }).isAlive = true; });
  // No modo dial (agente T3) o caps autoritativo é do relay (papel da conta vem do
  // JWT). O agente NÃO reanuncia caps — senão sobrescreveria o papel do viewer com
  // o papel-de-engine 'student'. busy/replay/stats seguem (estado de engine).
  if (sendCaps) send(ws, { t: 'caps', caps: capsFor(role, CONFIG) });
  // Fato do engine (a box) — vai sempre, inclusive no dial T3, pra a UI avisar
  // que nada roda até conectar uma conta Anthropic aqui.
  send(ws, { t: 'claude-auth', ready: claudeReady() });
  // MCP disponíveis (nomes) p/ o seletor por sessão. Default no engine = nenhum
  // carregado (--strict-mcp-config); a sessão liga só o que precisa.
  send(ws, { t: 'mcp-servers', servers: Object.keys(mcpServerDefsSync()) });
  send(ws, { t: 'busy', keys: [...threads.keys()] });
  const slash = getSlashCommands();
  if (slash.length) send(ws, { t: 'slash-commands', items: slash });
  const rate = getLastRate();
  if (rate) send(ws, { t: 'rate', ...rate });
  const planUsage = getLastPlanUsage();
  // Sem snapshot ainda (boot recente, ou o prime/poll falhou): pede um agora pra a
  // barra não ficar em "—" até o próximo poll de 60s. O broadcast atende este socket.
  if (planUsage) send(ws, { t: 'plan-usage', usage: planUsage });
  else requestPlanUsageRefresh();
  const models = getLastModels();
  if (models.length) send(ws, { t: 'models', models });
  // Reconnect mid-run (#10): replaya o snapshot acumulado SÓ pra ESTE socket,
  // pra a UI reconstruir o turno em voo. Os deltas seguintes chegam via broadcast.
  for (const [key, thread] of threads) {
    send(ws, { t: 'replay', sessionKey: key, text: thread.text, thinking: thread.thinking, tools: thread.tools, startedAt: thread.startedAt });
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
    // Frames de CONTROLE do relay (presença de browser) chegam neste socket no modo
    // dial e são tratados pelo listener dedicado em agent.ts. NÃO são ClientMsg do
    // dispatch — ignora ANTES do authorize, senão o allowlist default-deny respondia
    // 'sem permissão' (toast espúrio na aba a cada abrir/fechar) p/ agente student.
    const ctrlT = msg.t as string;
    if (ctrlT === 'browsers-present' || ctrlT === 'no-browsers') return;
    // Teto por conexão antes de qualquer trabalho: corta loop de frames (DoS).
    if (!limiter.allow(msg.t)) { send(ws, { t: 'error', message: 'muitas requisições' }); return; }
    // Checkpoint ÚNICO de autorização (default-deny), ANTES do handleTerm (que
    // trata term-* e retorna) e do dispatch/startRun.
    if (!authorize(role, msg.t)) {
      send(ws, { t: 'error', message: 'sem permissão' });
      return;
    }
    // handleTerm é síncrono e roda fora do .catch do handle — um frame de terminal
    // malformado que lançasse aqui viraria uncaughtException e derrubaria o processo
    // inteiro. O try isola o socket que mandou lixo.
    try {
      if (handleTerm(ws, msg, myTerms)) return;
    } catch (e) {
      send(ws, { t: 'error', message: sanitize(String((e as Error)?.message ?? e)) });
      return;
    }
    handle(ws, msg, role).catch((e) => send(ws, { t: 'error', message: sanitize(String(e?.message ?? e)) }));
  });

  ws.on('close', () => {
    for (const [id, h] of myTerms) detachTerm(id, h.onData, h.onExit);
    myTerms.clear();
  });
}
