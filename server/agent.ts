import { WebSocket } from 'ws';
import { generateKeyPairSync, createPrivateKey, sign as edSign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, loadavg, cpus, freemem } from 'node:os';
import type { Role } from './auth';
import { capsFor } from './auth';
import { CONFIG } from './config';
import { serveConnection } from './ws/serve-connection';
import { setClientSource, broadcast } from './ws/broadcast';
import { mcpServerDefsSync, claudeReady } from './admin-ops';
import { getSlashCommands } from './ws/slash';
import { killAllRuns, threads } from './ws/runs';
import { startModelsLoop, getLastModels } from './ws/models';
import { startPlanUsageLoop, getLastPlanUsage, requestPlanUsageRefresh } from './ws/usage-plan';
import { getLastRate } from './ws/rate';
import { startStatsLoop } from './ws/stats-loop';
import { startSessionsWatch } from './sessions/watch';
import { startPointsWatch } from './points-watch';
import { startDflPointsWatch } from './dfl-points-watch';
import { loadManagedEnv } from './admin-ops';

// Entrypoint do AGENTE T3 (DR-023): em vez de escutar (attachWs), DISCA pro relay
// e serve o MESMO protocolo pelo socket de saída. O relay encaminha os frames do
// browser daquela conta pra cá; o engine roda local (claude -p na VPS do fellow) e
// as respostas voltam por broadcast → setClientSource([socket]) → relay → browser.
// Reusa serveConnection (idêntico ao listen). A chave privada NASCE e FICA aqui.

const DIR = process.env.DECK_AGENT_DIR || join(homedir(), '.deck-agent');
const ID_FILE = join(DIR, 'identity.json');

// Role do engine deste agente. Default 'student' = least-capability (chat/sessões/
// contexts SEM term-*/bypass/admin) — seguro pra box de fellow. O DONO da própria
// box opta por 'admin' via DECK_AGENT_ROLE pra ter controle total (terminais,
// admin, etc): roteamento é por-conta, então só a conta dona alcança este agente.
// Sem isto, o relay anuncia caps de root/admin pro browser mas o agente nega tudo
// ("sem permissão" em term-open/admin/…).
const AGENT_ROLE: Role = process.env.DECK_AGENT_ROLE === 'admin' ? 'admin' : 'student';

export interface Identity { agentId: string; privateKeyPem: string; publicKey: string }

// Gera um par Ed25519. Privada em PKCS8 PEM (fica no disco do fellow, 0600);
// pública em SPKI DER base64 — o formato que o relay (verifyAgentSignature) espera.
export function generateIdentityKeys(): { privateKeyPem: string; publicKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  };
}

export function loadIdentity(): Identity | null {
  try { return JSON.parse(readFileSync(ID_FILE, 'utf8')) as Identity; } catch { return null; }
}

export function saveIdentity(id: Identity): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(ID_FILE, JSON.stringify(id, null, 2));
  try { chmodSync(ID_FILE, 0o600); } catch { /* best-effort em FS sem perms */ }
}

// Mensagem assinada no handshake = challenge + agentId (domain separation: a
// assinatura vale só pra este agente, não é reusável noutro contexto/endpoint).
export function challengeMessage(challenge: string, agentId: string): string {
  return `${challenge}.${agentId}`;
}

// Assina o challenge (domain-separado) com a privada. Base64, igual ao verify do relay.
export function signChallenge(privateKeyPem: string, challenge: string, agentId: string): string {
  return edSign(null, Buffer.from(challengeMessage(challenge, agentId)), createPrivateKey(privateKeyPem)).toString('base64');
}

// Backoff exponencial com teto (reconnect do dial; o listen nunca precisou).
export function backoffMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
}

// Socket cujo broadcast está ativo. Compare-and-clear: o 'close' do socket antigo
// NÃO pode zerar a fonte de um socket novo que já reconectou (race de reconnect).
let activeWs: WebSocket | null = null;
// Presença de browser na conta (sinal do relay: browsers-present/no-browsers). Os
// loops periódicos (stats 2s, plan-usage 60s, models) rodavam enquanto o agente
// estivesse pareado, mesmo sem NENHUMA aba aberta — queimava quota OAuth/CPU 24/7.
// Default true: se o relay for uma versão antiga (sem os frames), comporta como antes
// (loops rodam) — sem regressão; só PAUSA quando o relay novo diz que ninguém olha.
let browsersPresent = true;

// Reemite o bootstrap inteiro na chegada de um browser. No modo dial o
// serveConnection só faz o bootstrap UMA vez (no agent-ready, antes de qualquer
// aba). Um browser que abre/recarrega depois multiplexa no MESMO socket do agente
// — não dispara novo serveConnection — então precisa receber tudo de novo aqui,
// senão a barra de usage/telemetria/modelos/MCP fica vazia até o próximo poll (60s)
// ou até um prompt. Os snapshots são leituras baratas de cache.
function reemitBootstrap(ws: WebSocket): void {
  try {
    const s = (m: unknown) => ws.send(JSON.stringify(m));
    s({ t: 'claude-auth', ready: claudeReady() });
    s({ t: 'mcp-servers', servers: Object.keys(mcpServerDefsSync()) });
    const slash = getSlashCommands();
    if (slash.length) s({ t: 'slash-commands', items: slash });
    s({ t: 'busy', keys: [...threads.keys()] });
    const rate = getLastRate();
    if (rate) s({ t: 'rate', ...rate });
    const usage = getLastPlanUsage();
    if (usage) s({ t: 'plan-usage', usage });
    else requestPlanUsageRefresh(); // sem cache ainda: busca agora, não espera o poll
    const models = getLastModels();
    if (models.length) s({ t: 'models', models });
    // Reconecta no meio de um turno: replaya o snapshot acumulado pra reconstruir o
    // turno em voo (o serveConnection só replaya no agent-ready).
    for (const [key, thread] of threads) {
      s({ t: 'replay', sessionKey: key, text: thread.text, thinking: thread.thinking, tools: thread.tools, startedAt: thread.startedAt, sessionId: thread.sessionId });
    }
  } catch { /* socket indo embora */ }
}

function connect(relayUrl: string, id: Identity, onOpen: () => void, onClose: () => void, onAuthed: () => void): WebSocket {
  const ws = new WebSocket(`${relayUrl.replace(/\/$/, '')}/agent`);
  let ready = false;

  const onHandshake = (raw: import('ws').RawData) => {
    let m: { t?: string; nonce?: string } = {};
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.t === 'challenge' && typeof m.nonce === 'string') {
      ws.send(JSON.stringify({ t: 'agent-auth', sig: signChallenge(id.privateKeyPem, m.nonce, id.agentId) }));
    } else if (m.t === 'agent-ready') {
      if (ready) return;                            // idempotente: ignora 2º agent-ready
      ready = true;
      onAuthed();                                   // backoff só zera após AUTH ok (não no TCP-open)
      ws.removeListener('message', onHandshake);    // serveConnection assume o loop
      activeWs = ws;
      setClientSource({ clients: new Set([ws]) });  // broadcast sai por ESTE socket
      serveConnection(ws, { role: AGENT_ROLE, sendCaps: false }); // relay é a fonte do caps
      // bootstrap do serveConnection já replaya o último snapshot (models/plan-usage/
      // stats) PRA ESTE socket; os loops periódicos (startLoops no runAgent) seguem
      // emitindo via broadcast enquanto este socket for o activeWs.
      // canBypass é capacidade LOCAL do agente (allowBypass + localOnly + role admin):
      // o relay sozinho não sabe disso e força false. Reporta a real pro relay casar
      // com o papel do browser — o bypass continua aplicado SÓ aqui (bypassAllowed).
      ws.send(JSON.stringify({ t: 'agent-caps', canBypass: capsFor(AGENT_ROLE, CONFIG).canBypass }));
      // Listener adicional (coexiste com o do serveConnection): os frames de presença
      // do relay alternam os loops periódicos. São control-only — o dispatch os ignora
      // como tipo desconhecido, então não há conflito em receberem nos dois listeners.
      ws.on('message', (raw: Buffer) => {
        try {
          const p = JSON.parse(raw.toString()) as { t?: string };
          if (p.t === 'browsers-present') {
            const wasAbsent = !browsersPresent;
            browsersPresent = true;
            // Frames one-shot do bootstrap (mcp-servers, slash) foram enviados no
            // agent-ready — possivelmente antes de QUALQUER browser conectar. Os
            // loops periódicos cobrem stats/usage/models; estes não têm loop, então
            // um browser que chega depois nunca os recebia (seletor de MCP vazio,
            // slash sumido). Reemite na chegada de browser.
            if (wasAbsent) reemitBootstrap(ws);
          }
          else if (p.t === 'no-browsers') browsersPresent = false;
        } catch { /* não-JSON: ignora */ }
      });
    }
  };

  ws.on('open', () => { onOpen(); ws.send(JSON.stringify({ t: 'agent-hello', agentId: id.agentId })); });
  ws.on('message', onHandshake);
  ws.on('close', () => { if (activeWs === ws) { setClientSource(null); activeWs = null; browsersPresent = true; } onClose(); });
  ws.on('error', () => { /* o 'close' cuida do reconnect */ });

  // Health check do link: ping a cada 30s E checa o pong. Sem checar o pong um
  // socket meio-aberto (relay reiniciou, NAT dropou, laptop dormiu) fica "vivo"
  // pra sempre engolindo frames. Se não veio pong desde o último ping, o link
  // está morto → terminate() → dispara o 'close' → reconnect com backoff.
  // Também reconecta se o buffer de saída encalhar: um relay que para de DRENAR
  // (consumidor lento/meio-morto que ainda responde pong) deixa o bufferedAmount
  // crescer sem parar. Aí os loops periódicos (stats é 'droppable' no broadcast)
  // são descartados por backpressure e a telemetria/usage somem na UI mesmo com o
  // socket "aberto" — o bug que sumia com stats após horas. Encalhe = link morto.
  const MAX_BUFFERED = 1_000_000;
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const beat = setInterval(() => {
    if (!alive || ws.bufferedAmount > MAX_BUFFERED) { try { ws.terminate(); } catch { /* indo embora */ } return; }
    alive = false;
    try { ws.ping(); } catch { /* indo embora */ }
  }, 30_000);
  beat.unref();
  ws.on('close', () => clearInterval(beat));
  return ws;
}

// Pareia esta VPS com a conta dona do código. Gera (ou reusa) a keypair local,
// apresenta código+pubkey ao relay, salva o agentId devolvido. A privada nunca sai.
export function pairAgent(relayUrl: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = loadIdentity();
    const keys = existing?.privateKeyPem
      ? { privateKeyPem: existing.privateKeyPem, publicKey: existing.publicKey }
      : generateIdentityKeys();
    const ws = new WebSocket(`${relayUrl.replace(/\/$/, '')}/agent`);
    let done = false;
    ws.on('open', () => ws.send(JSON.stringify({ t: 'pair', code, publicKey: keys.publicKey })));
    ws.on('message', (raw) => {
      let m: { t?: string; agentId?: string } = {};
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.t === 'paired' && typeof m.agentId === 'string') {
        saveIdentity({ agentId: m.agentId, privateKeyPem: keys.privateKeyPem, publicKey: keys.publicKey });
        done = true;
        console.log(`[agent] pareado! identidade salva em ${ID_FILE}`);
        ws.close();
        resolve();
      }
    });
    ws.on('close', () => { if (!done) reject(new Error('pareamento falhou (código inválido/expirado?)')); });
    ws.on('error', (e) => { if (!done) reject(e); });
  });
}

// Memória disponível em MB. Lê MemAvailable do /proc (Linux, o que conta pra OOM);
// cai pra os.freemem() em FS sem /proc.
function availableMemMb(): number {
  try {
    const m = readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)\s+kB/);
    if (m) return Math.round(Number(m[1]) / 1024);
  } catch { /* sem /proc */ }
  return Math.round(freemem() / 1048576);
}

// Health check de RECURSO da VPS do fellow. O agente roda `claude -p` local: um run
// desgovernado pode estourar a RAM/CPU e TRAVAR a box (foi o medo do Samuel). A cada
// 60s, se o load passar de 4x os cores OU a memória cair abaixo de 120MB, mata os
// runs em andamento (killAllRuns) pra liberar a box ANTES do OOM-killer agir. O
// socket fica vivo; só os runs caem. unref() pra não segurar o processo.
export function startHealthGuard(): void {
  const cores = cpus().length || 1;
  const timer = setInterval(() => {
    const load1 = loadavg()[0];
    const memMb = availableMemMb();
    if (load1 > cores * 4 || memMb < 120) {
      console.error(`[agent] health: pressão (load1=${load1.toFixed(2)} mem=${memMb}MB) — matando runs pra não travar a VPS`);
      killAllRuns();
    }
  }, 60_000);
  timer.unref();
}

export function runAgent(relayUrl: string): void {
  const id = loadIdentity();
  if (!id?.agentId) {
    console.error('[agent] não pareado. Rode o pairing (npx @deck/agent --pair=CÓDIGO) primeiro.');
    process.exit(1);
  }
  startHealthGuard();
  void loadManagedEnv(); // tokens gerenciados (#162) p/ o spawn herdar
  // Loops periódicos (telemetria/usage/modelos) que o modo listen roda no attachWs.
  // No dial não há WebSocketServer, então a "presença de cliente" é o socket ativo
  // pro relay (activeWs). broadcast já sai por ele via setClientSource. Sem isto a
  // UI nunca recebe stats/plan-usage atualizados (barra de usage e telemetria
  // travadas em "carregando") nem as versões concretas dos modelos.
  const hasClients = () => activeWs !== null && browsersPresent;
  startStatsLoop(hasClients);
  startPlanUsageLoop(hasClients);
  startModelsLoop(hasClients);
  startSessionsWatch(hasClients);
  startPointsWatch(hasClients);
  startDflPointsWatch();
  // Backstop relay-agnóstico: se o relay não emitir 'browsers-present' (versão
  // antiga), a reemissão instantânea não dispara — rebroadcasta mcp-servers/slash
  // periodicamente pra o seletor de MCP nunca ficar vazio num browser tardio.
  const bootstrapTimer = setInterval(() => {
    if (!hasClients()) return;
    broadcast({ t: 'mcp-servers', servers: Object.keys(mcpServerDefsSync()) });
    const slash = getSlashCommands();
    if (slash.length) broadcast({ t: 'slash-commands', items: slash });
  }, 60_000);
  bootstrapTimer.unref();
  let attempt = 0;
  const loop = () => {
    connect(
      relayUrl, id,
      () => { /* TCP-open não zera o backoff: auth pode falhar logo após (4401) */ },
      () => {
        const wait = backoffMs(attempt++);
        console.error(`[agent] desconectado; reconectando em ${Math.round(wait / 1000)}s`);
        setTimeout(loop, wait);
      },
      () => { attempt = 0; },                        // reset SÓ após auth ok (agent-ready) — evita martelar relay+DB numa rejeição
    );
  };
  loop();
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

// SIGTERM/SIGINT matam o processo inteiro (deploy, doctor, restart manual) — mas
// threads ativas de QUALQUER sessão conectada (não só a que pediu o restart)
// morrem juntas. handle.kill() é fire-and-forget: o child.on('close') que dispara
// o 'done' do turno só roda num ciclo futuro do event loop, e process.exit(0)
// logo em seguida não dá esse ciclo — o cliente nunca recebe o 'done'/'error',
// fica com a bolha "pensando" pra sempre e não sabe que a run morreu (turno mudo).
// Fix: avisa cada sessão com turno ativo ANTES de matar, e só sai depois de dar
// tempo do frame de WS realmente sair pela rede.
function gracefulShutdown(): void {
  for (const sessionKey of threads.keys()) {
    broadcast({ t: 'error', sessionKey, message: 'Agente reiniciado — turno interrompido. Mande de novo.' });
  }
  killAllRuns();
  setTimeout(() => process.exit(0), 300);
}

// Execução direta: `tsx server/agent.ts [--pair=CÓDIGO]` (relay via DECK_RELAY_URL).
if (process.argv[1] && process.argv[1].endsWith('agent.ts')) {
  const url = process.env.DECK_RELAY_URL;
  if (!url) { console.error('[agent] defina DECK_RELAY_URL'); process.exit(1); }
  const pairArg = process.argv.find((a) => a.startsWith('--pair='));
  if (pairArg) {
    pairAgent(url, pairArg.slice('--pair='.length))
      .then(() => process.exit(0))
      .catch((e) => { console.error('[agent]', e.message ?? e); process.exit(1); });
  } else {
    runAgent(url);
  }
}
