import { createServer, type IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './routing';
import {
  makeJwks, verifyJwtSignature, validateClaims, makeChallenge, verifyAgentSignature,
  type JwksFn, type Identity,
} from './verify';
import { parseRootEmails } from '../../shared/identity';

// Relay T3 (DR-023): roteador WS stateless e autenticado. NÃO spawna nada (a
// fronteira é garantida pelo boundary.test) e NÃO guarda chave de assinatura — só
// material público (JWKS) e o que o Store devolve (pubkeys de agente). browser e
// agente entram por caminhos de auth SEPARADOS; o roteamento é por accountId
// derivado no servidor, nunca por chave do frame (red lines #1/#2).

// Camada de dados (Supabase) por trás de uma interface — o adapter concreto
// (REST + service-role) é injetado, mantendo o core testável e sem driver de DB.
export interface RelayStore {
  // pubkey + conta de um agente pareado e NÃO revogado; null se não existe/revogado.
  agentById(agentId: string): Promise<{ accountId: string; publicKey: string } | null>;
  // is_admin da conta (pra resolver role admin); root vem do env, não daqui.
  isAdmin(accountId: string): Promise<boolean>;
  markAgentSeen(agentId: string): Promise<void>;
  // Pairing: cria código (devolve texto plano 1x), consome atômico (→ accountId),
  // registra o agente pareado (→ agentId).
  createPairingCode(accountId: string, label?: string): Promise<string>;
  consumePairingCode(code: string): Promise<string | null>;
  createAgent(accountId: string, publicKey: string, label?: string): Promise<string | null>;
}

export interface RelayConfig {
  iss: string;            // issuer esperado do JWT (…/auth/v1)
  jwksUrl: string;        // JWKS do projeto Supabase
  rootEmails: string;     // CSV (COCKPIT_ROOT_EMAILS)
  store: RelayStore;
  maxPayload?: number;
}

const tokenFromUrl = (url: string | undefined): string | null => {
  try { return new URL(url ?? '', 'http://x').searchParams.get('token'); } catch { return null; }
};

interface AgentState { agentId: string; accountId: string; challenge: string; authed: boolean }

export function createRelay(cfg: RelayConfig) {
  const registry = new Registry();
  const roots = parseRootEmails(cfg.rootEmails);
  const jwks: JwksFn = makeJwks(cfg.jwksUrl);

  // Resolve a identidade de um JWT (Authorization: Bearer ou ?token=). Usado pelo
  // HTTP de pairing e poderia servir o WS — aqui só o que precisa de accountId.
  async function identityFrom(token: string | null): Promise<Identity | null> {
    if (!token) return null;
    const payload = await verifyJwtSignature(token, jwks, cfg.iss);
    const isAdmin = payload?.sub ? await cfg.store.isAdmin(String(payload.sub)) : false;
    return validateClaims(payload, { iss: cfg.iss, nowSec: Math.floor(nowMs() / 1000), rootEmails: roots, isAdmin });
  }

  const server = createServer(async (req, res) => {
    // POST /pair/new — o browser logado pede um código de pareamento (JWT no header).
    if (req.method === 'POST' && (req.url ?? '').split('?')[0] === '/pair/new') {
      const auth = req.headers.authorization ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : tokenFromUrl(req.url);
      const id = await identityFrom(token);
      if (!id) { res.writeHead(401); res.end('auth'); return; }
      try {
        const code = await cfg.store.createPairingCode(id.accountId);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code }));
      } catch { res.writeHead(500); res.end('error'); }
      return;
    }
    res.writeHead(426); res.end('upgrade required');
  });
  const wssBrowser = new WebSocketServer({ noServer: true, maxPayload: cfg.maxPayload ?? 4 * 1024 * 1024 });
  const wssAgent = new WebSocketServer({ noServer: true, maxPayload: cfg.maxPayload ?? 32 * 1024 * 1024 });

  // ── Browser path: JWT → accountId, route command frames to that account's agent.
  wssBrowser.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const token = tokenFromUrl(req.url);
    let id: Identity | null = null;
    if (token) {
      const payload = await verifyJwtSignature(token, jwks, cfg.iss);
      const isAdmin = payload?.sub ? await cfg.store.isAdmin(String(payload.sub)) : false;
      id = validateClaims(payload, { iss: cfg.iss, nowSec: Math.floor(nowMs() / 1000), rootEmails: roots, isAdmin });
    }
    if (!id) { ws.close(4401, 'auth'); return; }            // default-deny (red line #10)
    const accountId = id.accountId;
    registry.addBrowser(accountId, ws);
    // caps autoritativo do relay (papel da conta vem do JWT). canBypass=false: bypass
    // é local-only do agente, nunca concedido via relay.
    ws.send(JSON.stringify({ t: 'caps', caps: { role: id.role, canBypass: false } }));
    if (!registry.hasAgent(accountId)) ws.send(JSON.stringify({ t: 'agent-offline' }));
    ws.on('message', (data) => {
      // Roteia opaco pro agente DAQUELA conta. A autenticidade fim-a-fim do frame
      // (assinatura, T5) é verificada NO AGENTE, não aqui — o relay não confia em si.
      if (!registry.toAgent(accountId, data.toString())) ws.send(JSON.stringify({ t: 'agent-offline' }));
    });
    ws.on('close', () => registry.removeBrowser(accountId, ws));
  });

  // ── Agent path: challenge-signature (Ed25519). Pubkey/conta vêm do Store.
  wssAgent.on('connection', (ws: WebSocket) => {
    const st: AgentState = { agentId: '', accountId: '', challenge: '', authed: false };
    let attempts = 0;
    // Socket pré-auth não pode ficar pendurado (DB-amplification/exaustão): fecha
    // se não autenticar em 15s.
    const authTimer = setTimeout(() => { if (!st.authed) { try { ws.close(4408, 'auth timeout'); } catch { /* indo */ } } }, 15_000);
    authTimer.unref?.();
    ws.on('message', async (raw) => {
      let m: { t?: string; agentId?: string; sig?: string; code?: string; publicKey?: string } = {};
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!st.authed) {
        if (++attempts > 10) { try { ws.close(4429, 'too many attempts'); } catch { /* indo */ } return; }
        // Pairing: consome o código (atômico) → registra o agente → devolve agentId.
        if (m.t === 'pair' && typeof m.code === 'string' && typeof m.publicKey === 'string') {
          const accountId = await cfg.store.consumePairingCode(m.code);
          if (!accountId) { ws.close(4401, 'invalid code'); return; }
          const agentId = await cfg.store.createAgent(accountId, m.publicKey);
          if (!agentId) { ws.close(4500, 'pair failed'); return; }
          ws.send(JSON.stringify({ t: 'paired', agentId }));
          return;
        }
        if (m.t === 'agent-hello' && typeof m.agentId === 'string') {
          const rec = await cfg.store.agentById(m.agentId);
          if (!rec) { ws.close(4401, 'unknown agent'); return; }
          st.agentId = m.agentId; st.accountId = rec.accountId; st.challenge = makeChallenge();
          (st as AgentState & { pub?: string }).pub = rec.publicKey;
          ws.send(JSON.stringify({ t: 'challenge', nonce: st.challenge }));
          return;
        }
        if (m.t === 'agent-auth' && typeof m.sig === 'string') {
          const pub = (st as AgentState & { pub?: string }).pub ?? '';
          // Verifica sobre challenge+agentId (domain separation; casa com o agente).
          if (!st.challenge || !verifyAgentSignature(pub, `${st.challenge}.${st.agentId}`, m.sig)) { ws.close(4401, 'bad sig'); return; }
          st.authed = true;
          clearTimeout(authTimer);
          registry.bindAgent(st.accountId, ws);
          await cfg.store.markAgentSeen(st.agentId);
          ws.send(JSON.stringify({ t: 'agent-ready' }));
          // Avisa as abas da conta que o agente ficou online.
          registry.toBrowsers(st.accountId, JSON.stringify({ t: 'agent-online' }));
          return;
        }
        ws.close(4401, 'auth required'); return;
      }
      // Autenticado: frame do agente → as abas DAQUELA conta (escopo por conta).
      registry.toBrowsers(st.accountId, raw.toString());
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      if (st.authed) {
        registry.unbindAgent(st.accountId, ws);
        registry.toBrowsers(st.accountId, JSON.stringify({ t: 'agent-offline' }));
      }
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0];
    const target = path === '/agent' ? wssAgent : path === '/ws' ? wssBrowser : null;
    if (!target) { socket.destroy(); return; }
    target.handleUpgrade(req, socket, head, (ws) => target.emit('connection', ws, req));
  });

  // Heartbeat: termina sockets meio-abertos (laptop dormindo, sem FIN) em ambos os
  // servidores — sem isto o buffer de um cliente morto cresce até o OOM, e um agente
  // morto fica "online" engolindo frames. Espelha o sweep do server/ws.ts.
  for (const w of [wssBrowser, wssAgent]) {
    w.on('connection', (ws: WebSocket) => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
      ws.on('pong', () => { (ws as WebSocket & { isAlive?: boolean }).isAlive = true; });
    });
  }
  const beat = setInterval(() => {
    for (const w of [wssBrowser, wssAgent]) {
      for (const c of w.clients) {
        if ((c as WebSocket & { isAlive?: boolean }).isAlive === false) { c.terminate(); continue; }
        (c as WebSocket & { isAlive?: boolean }).isAlive = false;
        try { c.ping(); } catch { /* indo embora */ }
      }
    }
  }, 30_000);
  beat.unref();
  server.on('close', () => clearInterval(beat));

  return { server, registry };
}

// new Date()/Date.now() ficam num único ponto pra não espalhar dependência de tempo.
function nowMs(): number { return Date.now(); }
