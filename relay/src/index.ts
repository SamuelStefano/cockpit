import { createServer, type IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './routing';
import {
  makeJwks, verifyJwtSignature, validateClaims, makeChallenge, verifyAgentSignature,
  type JwksFn, type Identity,
} from './verify';
import { parseRootEmails, canSeeAllAccounts, canGrantAdmin, type AccountRole } from '../../shared/identity';

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
  // Todas as contas (painel admin: listar usuários). Service-role; só root/admin
  // chamam via relay. lastSeen = agente VPS mais recente da conta.
  listAccounts(): Promise<Array<{ id: string; email: string; isAdmin: boolean }>>;
  // Liga/desliga is_admin de uma conta (só root concede — canGrantAdmin). Via
  // service-role (o guard de coluna no Postgres só deixa o service-role escrever).
  setAdmin(accountId: string, admin: boolean): Promise<boolean>;
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
  // Override da resolução de identidade do browser (default: JWT via JWKS). Existe
  // só pra TESTE de integração local (stub) — em prod fica undefined = JWKS real.
  resolveIdentity?: (token: string | null) => Promise<Identity | null>;
}

const tokenFromUrl = (url: string | undefined): string | null => {
  try { return new URL(url ?? '', 'http://x').searchParams.get('token'); } catch { return null; }
};

interface AgentState { agentId: string; accountId: string; challenge: string; authed: boolean }

export function createRelay(cfg: RelayConfig) {
  const registry = new Registry();
  const roots = parseRootEmails(cfg.rootEmails);
  const jwks: JwksFn = makeJwks(cfg.jwksUrl);

  // canBypass é capacidade LOCAL do agente (allowBypass + localOnly + role admin do
  // agente); o relay não tem como saber, então o agente reporta via 'agent-caps'.
  // O relay só CASA com o papel admin do browser — nunca concede sozinho (red line:
  // bypass = RCE root). A aplicação real continua no agente (bypassAllowed).
  const agentBypass = new Map<string, boolean>();
  type BrowserSock = WebSocket & { _role?: AccountRole };
  // Privilegiado = root/admin (canSeeAllAccounts). canBypass só pra esses E se o
  // agente reportou capacidade local; o agente reaplica o gate de qualquer forma.
  const capsFrame = (role: AccountRole, accountId: string) =>
    JSON.stringify({ t: 'caps', caps: { role, canBypass: canSeeAllAccounts(role) && (agentBypass.get(accountId) ?? false) } });

  // Resolve a identidade de um JWT (Authorization: Bearer ou ?token=). Usado pelo
  // HTTP de pairing e pelo path do browser. O override (cfg.resolveIdentity) é só
  // pra teste local; em prod é o caminho JWKS real abaixo.
  async function identityFrom(token: string | null): Promise<Identity | null> {
    if (cfg.resolveIdentity) return cfg.resolveIdentity(token);
    if (!token) return null;
    const payload = await verifyJwtSignature(token, jwks, cfg.iss);
    const isAdmin = payload?.sub ? await cfg.store.isAdmin(String(payload.sub)) : false;
    return validateClaims(payload, { iss: cfg.iss, nowSec: Math.floor(nowMs() / 1000), rootEmails: roots, isAdmin });
  }

  // CORS: o SPA (Vercel) chama /pair/new cross-origin com Authorization. O browser
  // dispara preflight OPTIONS e exige ACAO na resposta. A fronteira de segurança
  // aqui é o JWT (não o CORS), então refletimos a Origin do chamador.
  const setCors = (req: IncomingMessage, res: import('node:http').ServerResponse) => {
    res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-max-age', '600');
  };

  const server = createServer(async (req, res) => {
    setCors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
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
    // O cliente dispara `list`/`list-archived`/… no onopen, ANTES de a auth (await
    // do JWKS) terminar e o listener real ser anexado. Sem capturar, o `ws` descarta
    // esses frames (sem listener) e a aba nunca recebe `sessions` → sidebar vazio em
    // prod/relay. Bufferiza os frames pré-auth e os drena depois de autenticar.
    const early: string[] = [];
    const buffer = (data: import('ws').RawData) => { early.push(data.toString()); };
    ws.on('message', buffer);

    const id = await identityFrom(tokenFromUrl(req.url));
    if (!id) { ws.close(4401, 'auth'); return; }            // default-deny (red line #10)
    const accountId = id.accountId;
    (ws as BrowserSock)._role = id.role;                     // pra reemitir caps no agent-caps
    registry.addBrowser(accountId, ws);
    // caps autoritativo do relay (papel da conta vem do JWT). canBypass casa o papel
    // privilegiado com a capacidade que o agente reportou — o gate real é no agente.
    ws.send(capsFrame(id.role, accountId));
    // Estado ATUAL do agente pra esta aba. Antes só mandava agent-offline; uma aba
    // que conectava com o agente JÁ online nunca recebia agent-online e ficava presa
    // na tela de pareamento (agentOnline inicia false no modo relay).
    ws.send(JSON.stringify({ t: registry.hasAgent(accountId) ? 'agent-online' : 'agent-offline' }));

    const onFrame = async (s: string) => {
      // Frames de administração de CONTA (T3): tratados NO RELAY (só ele tem a
      // service-role do Supabase). Gate por papel da conta vindo do JWT — nunca
      // do frame. Não são repassados ao agente (que não tem acesso ao banco).
      if (s.includes('"accounts-list"') || s.includes('"set-admin"')) {
        let m: { t?: string; accountId?: string; admin?: boolean } = {};
        try { m = JSON.parse(s); } catch { return; }
        if (m.t === 'accounts-list') {
          if (!canSeeAllAccounts(id.role)) return;           // default-deny
          const rows = await cfg.store.listAccounts();
          ws.send(JSON.stringify({
            t: 'accounts',
            accounts: rows.map((a) => ({ ...a, agentOnline: registry.hasAgent(a.id) })),
          }));
          return;
        }
        if (m.t === 'set-admin' && typeof m.accountId === 'string' && typeof m.admin === 'boolean') {
          if (!canGrantAdmin(id.role)) return;                // só root concede admin
          await cfg.store.setAdmin(m.accountId, m.admin);
          const rows = await cfg.store.listAccounts();
          ws.send(JSON.stringify({
            t: 'accounts',
            accounts: rows.map((a) => ({ ...a, agentOnline: registry.hasAgent(a.id) })),
          }));
          return;
        }
        return;
      }
      // Roteia opaco pro agente DAQUELA conta. A autenticidade fim-a-fim do frame
      // (assinatura, T5) é verificada NO AGENTE, não aqui — o relay não confia em si.
      if (!registry.toAgent(accountId, s)) ws.send(JSON.stringify({ t: 'agent-offline' }));
    };

    ws.off('message', buffer);
    ws.on('message', (data) => { void onFrame(data.toString()); });
    for (const s of early) void onFrame(s);   // drena na ordem de chegada
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
      // Frame de controle do agente: 'agent-caps' reporta a capacidade LOCAL (bypass).
      // É consumido aqui (não repassado) e reemite caps pra cada aba já conectada,
      // casando o papel privilegiado dela com a capacidade real do agente.
      const s = raw.toString();
      if (s.includes('"agent-caps"')) {
        let m: { t?: string; canBypass?: boolean } = {};
        try { m = JSON.parse(s); } catch { /* repassa abaixo */ }
        if (m.t === 'agent-caps') {
          agentBypass.set(st.accountId, !!m.canBypass);
          registry.eachBrowser(st.accountId, (b) => {
            const role = (b as BrowserSock)._role;
            if (role) b.send(capsFrame(role, st.accountId));
          });
          return;
        }
      }
      // Autenticado: frame do agente → as abas DAQUELA conta (escopo por conta).
      registry.toBrowsers(st.accountId, s);
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      if (st.authed) {
        registry.unbindAgent(st.accountId, ws);
        agentBypass.delete(st.accountId);
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
