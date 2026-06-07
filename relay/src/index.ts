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
  const server = createServer((_req, res) => { res.writeHead(426); res.end('upgrade required'); });
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
    ws.send(JSON.stringify({ t: 'caps', caps: { role: id.role } }));
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
    ws.on('message', async (raw) => {
      let m: { t?: string; agentId?: string; sig?: string } = {};
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!st.authed) {
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
          if (!st.challenge || !verifyAgentSignature(pub, st.challenge, m.sig)) { ws.close(4401, 'bad sig'); return; }
          st.authed = true;
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

  return { server, registry };
}

// new Date()/Date.now() ficam num único ponto pra não espalhar dependência de tempo.
function nowMs(): number { return Date.now(); }
