import { createServer, type IncomingMessage } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './routing';
import {
  makeJwks, verifyJwtSignature, validateClaims, makeChallenge, verifyAgentSignature, isEd25519Spki,
  type JwksFn, type Identity,
} from './verify';
import { slidingWindow } from './throttle';
import { parseCsvSet, clientIp, originAllowed, tokenFromSubprotocol, pickSubprotocol, rawLength, makeLimiter } from './guards';
import { parseRootEmails, canSeeAllAccounts, canGrantAdmin, canListAccounts, type AccountRole } from '../../shared/identity';
import { isRootOnlyFrame } from '../../shared/root-frames';
import { isBoxId, sanitizeBoxLabel, type BoxesFrame } from '../../shared/boxes';

// Relay T3 (DR-023): roteador WS stateless e autenticado. NÃO spawna nada (a
// fronteira é garantida pelo boundary.test) e NÃO guarda chave de assinatura — só
// material público (JWKS) e o que o Store devolve (pubkeys de agente). browser e
// agente entram por caminhos de auth SEPARADOS; o roteamento é por accountId
// derivado no servidor, nunca por chave do frame (red lines #1/#2).

// Camada de dados (Supabase) por trás de uma interface — o adapter concreto
// (REST + service-role) é injetado, mantendo o core testável e sem driver de DB.
export interface RelayStore {
  // pubkey + conta de um agente pareado e NÃO revogado; null se não existe/revogado.
  // pairedAt ranks the account's boxes: the earliest-paired online one is the primary.
  agentById(agentId: string): Promise<{ accountId: string; publicKey: string; pairedAt?: string } | null>;
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
  // Devolve o código em texto plano UMA vez + quando ele expira, pra o browser
  // mostrar a contagem regressiva em vez de "aguardando o agente…" pra sempre.
  createPairingCode(accountId: string, label?: string): Promise<{ code: string; expiresAt: string }>;
  consumePairingCode(code: string): Promise<string | null>;
  createAgent(accountId: string, publicKey: string, label?: string): Promise<string | null>;
  // The account's paired, non-revoked boxes (kind 'vps'), oldest first.
  listBoxes(accountId: string): Promise<Array<{ id: string; label: string; lastSeen: string | null }>>;
  // Scoped to the account: false when the box is not one of its live boxes.
  renameBox(accountId: string, agentId: string, label: string): Promise<boolean>;
  revokeBox(accountId: string, agentId: string): Promise<boolean>;
}

export interface RelayConfig {
  iss: string;            // issuer esperado do JWT (…/auth/v1)
  jwksUrl: string;        // JWKS do projeto Supabase
  rootEmails: string;     // CSV (COCKPIT_ROOT_EMAILS)
  // CSV of Supabase user ids (COCKPIT_ROOT_USER_IDS). Non-empty = root also needs sub in it.
  rootUserIds?: string;
  // CSV of exact origins (DECK_ALLOWED_ORIGINS). Empty = any origin (legacy).
  allowedOrigins?: string;
  maxSocketsPerIp?: number;     // DECK_MAX_SOCKETS_PER_IP, default 64
  maxTabsPerAccount?: number;   // DECK_MAX_TABS_PER_ACCOUNT, default 20 (per box)
  maxBoxesPerAccount?: number;  // DECK_MAX_BOXES_PER_ACCOUNT, default 10
  store: RelayStore;
  maxPayload?: number;
  // Segredo do /status detalhado (DECK_STATUS_TOKEN). Ausente = só o corpo público.
  statusToken?: string;
  // Override da resolução de identidade do browser (default: JWT via JWKS). Existe
  // só pra TESTE de integração local (stub) — em prod fica undefined = JWKS real.
  resolveIdentity?: (token: string | null) => Promise<Identity | null>;
}

const tokenFromUrl = (url: string | undefined): string | null => {
  try { return new URL(url ?? '', 'http://x').searchParams.get('token'); } catch { return null; }
};
const boxFromUrl = (url: string | undefined): { box: string | null; peek: boolean } => {
  try {
    const q = new URL(url ?? '', 'http://x').searchParams;
    return { box: q.get('box'), peek: q.get('peek') === '1' };
  } catch { return { box: null, peek: false }; }
};
// Peeks are read-only views of another box (sidebar); bounded on their own so they
// never eat the tab cap of the box someone switches to.
const MAX_PEEKS_PER_BOX = 8;

interface AgentState { agentId: string; accountId: string; challenge: string; authed: boolean; helloPending?: boolean; rank?: number }

const MAX_TIMER_MS = 2 ** 31 - 1;

export function createRelay(cfg: RelayConfig) {
  // O stub de identidade desliga a verificação de JWT inteira. Só o main.ts sobe em
  // produção e ele nunca passa isto — mas uma linha errada num refactor abriria o
  // relay pra qualquer token. A unit do systemd fixa NODE_ENV=production.
  if (cfg.resolveIdentity && process.env.NODE_ENV === 'production') {
    throw new Error('resolveIdentity é stub de teste: proibido em produção');
  }
  const registry = new Registry();
  const startedAt = nowMs();
  const roots = parseRootEmails(cfg.rootEmails);
  const rootIds = parseCsvSet(cfg.rootUserIds);
  const origins = parseCsvSet(cfg.allowedOrigins);
  const acquireIp = makeLimiter(cfg.maxSocketsPerIp ?? 64);
  const maxTabs = cfg.maxTabsPerAccount ?? 20;
  const maxBoxes = cfg.maxBoxesPerAccount ?? 10;
  // Rename/revoke write the DB through the service role: bounded like /pair/new.
  const boxThrottle = slidingWindow(10, 60_000);
  // Agents send no Origin and the sealed channel is opaque: 16KB is far above any
  // legitimate handshake frame (hello/auth/pair) and bounds what an unauthed peer can push.
  const AGENT_PREAUTH_MAX = 16 * 1024;
  const jwks: JwksFn = makeJwks(cfg.jwksUrl);
  const pairThrottle = slidingWindow(5, 60_000);
  // Sealed channels (T5) are per tab: each browser socket gets a routing id the
  // agent addresses its encrypted frames to. Random, never derived from the JWT.
  const conns = new Map<string, { ws: WebSocket; accountId: string }>();

  // canBypass é capacidade LOCAL do agente (allowBypass + localOnly + role admin do
  // agente); o relay não tem como saber, então o agente reporta via 'agent-caps'.
  // O relay só CASA com o papel admin do browser — nunca concede sozinho (red line:
  // bypass = RCE root). A aplicação real continua no agente (bypassAllowed).
  // Keyed by agent id: each box reports its own capability.
  const agentBypass = new Map<string, boolean>();
  type BrowserSock = WebSocket & { _role?: AccountRole };
  // Privilegiado = root/admin (canSeeAllAccounts). canBypass só pra esses E se o
  // agente reportou capacidade local; o agente reaplica o gate de qualquer forma.
  const capsFrame = (role: AccountRole, agentId: string | null) =>
    JSON.stringify({ t: 'caps', caps: { role, canBypass: canSeeAllAccounts(role) && !!agentId && (agentBypass.get(agentId) ?? false) } });

  // Labels/last-seen come from the DB; online state from the registry at send
  // time. Cached per account so an agent flapping doesn't hit the DB each time.
  const boxRows = new Map<string, Promise<Array<{ id: string; label: string; lastSeen: string | null }>>>();
  const rowsFor = (accountId: string) => {
    let p = boxRows.get(accountId);
    if (!p) {
      p = cfg.store.listBoxes(accountId);
      boxRows.set(accountId, p);
      p.catch(() => { if (boxRows.get(accountId) === p) boxRows.delete(accountId); });
    }
    return p;
  };
  const boxesFrame = (accountId: string, box: string, rows: Array<{ id: string; label: string; lastSeen: string | null }>): string => {
    const online = new Set(registry.agentIds(accountId));
    const frame: BoxesFrame = {
      t: 'boxes',
      box: box || null,
      primary: registry.primary(accountId),
      boxes: rows.map((r) => ({ id: r.id, label: r.label, online: online.has(r.id), lastSeen: r.lastSeen })),
    };
    return JSON.stringify(frame);
  };
  const sendBoxes = async (accountId: string, only?: WebSocket) => {
    if (registry.browserTotal(accountId) === 0) return;
    try {
      const rows = await rowsFor(accountId);
      const send = (s: WebSocket) => { const box = registry.boxOf(accountId, s); if (box !== undefined) s.send(boxesFrame(accountId, box, rows)); };
      if (only) { if (only.readyState === WebSocket.OPEN) send(only); return; }
      registry.eachBrowser(accountId, (s) => send(s as WebSocket));
    } catch (e) { console.error('[relay] boxes:', e); }
  };
  const flushPresence = (accountId: string) => {
    for (const [, sock, present] of registry.presenceChanges(accountId)) {
      try { sock.send(JSON.stringify({ t: present ? 'browsers-present' : 'no-browsers' })); } catch { /* indo */ }
    }
  };

  // Resolve a identidade de um JWT. O override (cfg.resolveIdentity) é só pra teste
  // local; em prod é o caminho JWKS real abaixo.
  // Resolver identidade encosta na REDE (JWKS e `store.isAdmin` no PostgREST). Uma
  // falha ali NÃO pode escapar como rejeição: os dois chamadores são handlers async
  // de evento, então a rejeição vira unhandledRejection e o Node derruba o processo
  // — um soluço do Supabase desconectaria TODAS as contas. Falhou = nega.
  async function identityFrom(token: string | null): Promise<Identity | null> {
    try {
      if (cfg.resolveIdentity) return await cfg.resolveIdentity(token);
      if (!token) return null;
      const payload = await verifyJwtSignature(token, jwks, cfg.iss);
      const isAdmin = payload?.sub ? await cfg.store.isAdmin(String(payload.sub)) : false;
      return validateClaims(payload, { iss: cfg.iss, nowSec: Math.floor(nowMs() / 1000), rootEmails: roots, rootUserIds: rootIds, isAdmin });
    } catch (e) {
      console.error('[relay] identityFrom:', e);
      return null;
    }
  }

  // CORS: o SPA (Vercel) chama /pair/new cross-origin com Authorization. O browser
  // dispara preflight OPTIONS e exige ACAO na resposta. A fronteira de segurança
  // aqui é o JWT (não o CORS), então refletimos a Origin do chamador.
  const setCors = (req: IncomingMessage, res: import('node:http').ServerResponse) => {
    const origin = req.headers.origin;
    if (origins.size === 0) res.setHeader('access-control-allow-origin', origin ?? '*');
    else if (origin && origins.has(origin)) res.setHeader('access-control-allow-origin', origin);
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
      // Só header: JWT em query string vaza pro access log do Caddy (e pro Referer).
      // O WS precisa de `?token=` porque o browser não deixa mandar header no
      // handshake; aqui é um POST comum, então não há desculpa.
      const auth = req.headers.authorization ?? '';
      const id = auth.startsWith('Bearer ') ? await identityFrom(auth.slice(7)) : null;
      if (!id) { res.writeHead(401); res.end('auth'); return; }
      // Cada código é uma linha nova no banco com TTL de 10min: sem teto, uma conta
      // logada em loop enche a tabela de graça.
      if (!pairThrottle(id.accountId)) { res.writeHead(429); res.end('slow down'); return; }
      try {
        if ((await cfg.store.listBoxes(id.accountId)).length >= maxBoxes) { res.writeHead(409); res.end('box limit'); return; }
        const { code, expiresAt } = await cfg.store.createPairingCode(id.accountId);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code, expiresAt }));
      } catch { res.writeHead(500); res.end('error'); }
      return;
    }
    // GET /status — sonda do monitor externo. O corpo PÚBLICO é deliberadamente
    // pobre (vivo? há quanto tempo?): contagem de contas e de agentes online é dado
    // de negócio e fica atrás do segredo. Sem DECK_STATUS_TOKEN configurado o detalhe
    // não existe — default-deny, não "aberto por enquanto".
    if (req.method === 'GET' && (req.url ?? '').split('?')[0] === '/status') {
      const auth = req.headers.authorization ?? '';
      const detailed = auth.startsWith('Bearer ') && secretEquals(cfg.statusToken, auth.slice(7));
      const body: Record<string, unknown> = { ok: true, uptimeSec: Math.floor((nowMs() - startedAt) / 1000) };
      if (detailed) {
        const s = registry.stats();
        body.accounts = s.accounts;
        body.agents = s.agents;
        body.browsers = s.browsers;
        body.rssMb = Math.round(process.memoryUsage().rss / 1048576);
      }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
      return;
    }
    res.writeHead(426); res.end('upgrade required');
  });
  // Upload vai INLINE como frame WS (base64, +33%). O hop browser→relay precisa
  // acomodar o mesmo teto do agente/backend (32MB) — antes era 4MB e DERRUBAVA o
  // socket (close 1009) em qualquer anexo >~3MB que todo o resto da cadeia aceitaria.
  const wssBrowser = new WebSocketServer({ noServer: true, maxPayload: cfg.maxPayload ?? 32 * 1024 * 1024, handleProtocols: pickSubprotocol });
  const wssAgent = new WebSocketServer({ noServer: true, maxPayload: cfg.maxPayload ?? 32 * 1024 * 1024 });

  // ── Browser path: JWT → accountId, route command frames to that account's agent.
  wssBrowser.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    // O cliente dispara `list`/`list-archived`/… no onopen, ANTES de a auth (await
    // do JWKS) terminar e o listener real ser anexado. Sem capturar, o `ws` descarta
    // esses frames (sem listener) e a aba nunca recebe `sessions` → sidebar vazio em
    // prod/relay. Bufferiza os frames pré-auth e os drena depois de autenticar.
    // Teto do buffer pré-auth: um socket que nunca autentica (ou um atacante) podia
    // despejar frames sem limite durante o await do JWKS até estourar a heap. Frames
    // legítimos pré-auth são ~4 (list/usage/skill-list). Acima do teto, fecha.
    const early: string[] = [];
    let earlyBytes = 0;
    const buffer = (data: import('ws').RawData) => {
      const s = data.toString();
      if (early.length >= 32 || earlyBytes + s.length > 256 * 1024) { try { ws.close(4413, 'pre-auth flood'); } catch { /* indo */ } return; }
      earlyBytes += s.length;
      early.push(s);
    };
    ws.on('message', buffer);

    // Espelha o authTimer do agente: socket que não autenticou não fica pendurado
    // ocupando slot. O caminho de auth é limitado (JWKS + store têm timeout), então
    // este teto só dispara quando algo abaixo trava de vez.
    const authTimer = setTimeout(() => { try { ws.close(4408, 'auth timeout'); } catch { /* indo */ } }, 20_000);
    authTimer.unref?.();

    // `?box=` only picks WHICH of the JWT account's boxes this tab talks to; it is
    // never authority. A box of another account resolves to "offline", like an
    // unknown one. Anything that isn't a uuid is refused before the JWT work.
    const { box: rawBox, peek } = boxFromUrl(req.url);
    if ((rawBox !== null && !isBoxId(rawBox)) || (peek && rawBox === null)) { clearTimeout(authTimer); ws.close(4400, 'bad box'); return; }
    const box = rawBox ? rawBox.toLowerCase() : '';
    const id = await identityFrom(tokenFromSubprotocol(req.headers['sec-websocket-protocol']) ?? tokenFromUrl(req.url));
    clearTimeout(authTimer);
    // The socket may have closed during the await (F5, pre-auth flood, auth
    // timeout). Its 'close' already fired with no listener, so registering it now
    // would leave a dead tab in the registry forever and the agent would never get
    // `no-browsers`.
    if (ws.readyState !== WebSocket.OPEN) return;
    if (!id) { ws.close(4401, 'auth'); return; }            // default-deny (red line #10)
    const accountId = id.accountId;
    // Checked and registered with no await in between, so concurrent opens can't overshoot.
    if (registry.browserCount(accountId, box, peek) >= (peek ? MAX_PEEKS_PER_BOX : maxTabs)) { ws.close(4429, 'too many tabs'); return; }
    (ws as BrowserSock)._role = id.role;                     // pra reemitir caps no agent-caps
    const connId = randomBytes(16).toString('base64url');
    conns.set(connId, { ws, accountId });
    ws.on('close', () => {
      conns.delete(connId);
      registry.toAgent(accountId, box, JSON.stringify({ t: 'e2e-gone', c: connId }));
    });
    // Close at the JWT's expiry with a non-4401 code: the client redials with its
    // (refreshed) token; an expired/revoked one then gets 4401.
    // Delays past 2^31-1 ms (~24.8 days) make setTimeout fire at once: a long-lived
    // token would be closed immediately, in a loop. Such a token gets no timer.
    if (id.expMs !== undefined && id.expMs - nowMs() <= MAX_TIMER_MS) {
      const expTimer = setTimeout(() => { try { ws.close(4001, 'token expired'); } catch { /* indo */ } }, Math.max(0, id.expMs - nowMs()));
      expTimer.unref?.();
      ws.on('close', () => clearTimeout(expTimer));
    }
    // Primeira aba de um box (0→1) → avisa aquele agente que há alguém olhando (liga loops).
    registry.addBrowser(accountId, ws, box, peek);
    flushPresence(accountId);
    // caps autoritativo do relay (papel da conta vem do JWT). canBypass casa o papel
    // privilegiado com a capacidade que o agente reportou — o gate real é no agente.
    const target = registry.resolve(accountId, box);
    ws.send(capsFrame(id.role, target));
    // Estado ATUAL do agente pra esta aba. Antes só mandava agent-offline; uma aba
    // que conectava com o agente JÁ online nunca recebia agent-online e ficava presa
    // na tela de pareamento (agentOnline inicia false no modo relay).
    ws.send(JSON.stringify(target ? { t: 'agent-online', box: target } : { t: 'agent-offline', box: box || null }));
    void sendBoxes(accountId, ws);

    const onFrame = async (s: string) => {
      // Sealed frame: opaque to the relay. The channel id is APPENDED, so it is
      // the last "c" key and wins over any "c" the browser put in the frame.
      if (s.startsWith('{"t":"e2e') && s.endsWith('}')) {
        if (!registry.toAgent(accountId, box, `${s.slice(0, -1)},"c":"${connId}"}`)) ws.send(JSON.stringify({ t: 'agent-offline', box: box || null }));
        return;
      }
      // Frames de administração de CONTA (T3): tratados NO RELAY (só ele tem a
      // service-role do Supabase). Gate por papel da conta vindo do JWT — nunca
      // do frame. Não são repassados ao agente (que não tem acesso ao banco).
      if (maybeControlFrame(s, 'accounts-list', 'set-admin')) {
        let m: { t?: string; accountId?: string; admin?: boolean } = {};
        try { m = JSON.parse(s); } catch { m = {}; }
        // O pré-filtro é por SUBSTRING (evitar JSON.parse em todo frame, que chega a
        // 32MB de base64 em upload). Ele acerta em qualquer frame que só MENCIONE o
        // texto — um chat perguntando sobre "accounts-list". Se o `t` não for de
        // administração, o frame CAI FORA daqui e segue pro agente; engolir aqui era
        // uma mensagem sumindo em silêncio.
        if (m.t === 'accounts-list') {
          if (!canListAccounts(id.role)) return;             // default-deny
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
          // The target's open tabs cached the old role at open (accounts-list etc.):
          // make them redial and resolve the new one.
          // Not the requester's own socket (root changing its own account): it is
          // about to receive the refreshed list.
          registry.eachBrowser(m.accountId, (s) => { if (s !== ws) { try { (s as WebSocket).close(4001, 'role changed'); } catch { /* indo */ } } });
          const rows = await cfg.store.listAccounts();
          ws.send(JSON.stringify({
            t: 'accounts',
            accounts: rows.map((a) => ({ ...a, agentOnline: registry.hasAgent(a.id) })),
          }));
          return;
        }
        // Frame de administração malformado/negado nunca é repassado: o agente não
        // fala com o banco e não teria o que fazer com ele.
        if (m.t === 'accounts-list' || m.t === 'set-admin') return;
      }
      // Box management (rename/revoke): the relay owns the box list, so it handles
      // these itself, scoped to the JWT's account in the DB filter. Never forwarded.
      if (maybeControlFrame(s, 'box-rename', 'box-revoke')) {
        let m: { t?: string; id?: unknown; label?: unknown } = {};
        try { m = JSON.parse(s); } catch { m = {}; }
        if (m.t === 'box-rename' || m.t === 'box-revoke') {
          const fail = () => ws.send(JSON.stringify({ t: 'box-error', op: m.t, id: typeof m.id === 'string' ? m.id.slice(0, 64) : null }));
          if (!isBoxId(m.id) || !boxThrottle(accountId)) { fail(); return; }
          const target = m.id.toLowerCase();
          const label = sanitizeBoxLabel(m.label);
          const ok = m.t === 'box-rename'
            ? !!label && await cfg.store.renameBox(accountId, target, label)
            : await cfg.store.revokeBox(accountId, target);
          if (!ok) { fail(); return; }
          boxRows.delete(accountId);
          // Revoked: cut the box now. Its next agent-hello fails (agentById filters
          // revoked_at); the tabs it served get agent-offline from its close handler.
          if (m.t === 'box-revoke') registry.agentSocket(accountId, target)?.terminate?.();
          void sendBoxes(accountId);
          return;
        }
      }
      // Owner-only frames (points, host write-ops) need a root ACCOUNT, and only the
      // relay knows the account role. Parsed, not substring-matched (a JSON escape
      // hides the name); root skips the parse, and browser frames are small (uploads
      // go in ~700KB chunks), so the other roles pay one JSON.parse per frame.
      if (id.role !== 'root' && isRootOnlyFrame(s)) {
        ws.send(JSON.stringify({ t: 'error', message: 'sem permissão' }));
        return;
      }
      // Roteia opaco pro agente DAQUELA conta. A autenticidade fim-a-fim do frame
      // (assinatura, T5) é verificada NO AGENTE, não aqui — o relay não confia em si.
      if (!registry.toAgent(accountId, box, s)) ws.send(JSON.stringify({ t: 'agent-offline', box: box || null }));
    };

    // `onFrame` chama o store (accounts-list/set-admin). Rejeição solta num handler
    // de evento = unhandledRejection = processo morto. Falhou = não responde.
    const feed = (s: string) => { onFrame(s).catch((e) => console.error('[relay] browser frame:', e)); };
    ws.off('message', buffer);
    ws.on('message', (data) => feed(data.toString()));
    for (const s of early) feed(s);           // drena na ordem de chegada
    // Última aba de um box (1→0) → avisa aquele agente que ninguém está olhando (pausa loops).
    ws.on('close', () => {
      registry.removeBrowser(accountId, ws);
      flushPresence(accountId);
      if (registry.browserTotal(accountId) === 0) boxRows.delete(accountId);
    });
  });

  // ── Agent path: challenge-signature (Ed25519). Pubkey/conta vêm do Store.
  wssAgent.on('connection', (ws: WebSocket) => {
    const st: AgentState = { agentId: '', accountId: '', challenge: '', authed: false };
    let attempts = 0;
    // Socket pré-auth não pode ficar pendurado (DB-amplification/exaustão): fecha
    // se não autenticar em 15s.
    const authTimer = setTimeout(() => { if (!st.authed) { try { ws.close(4408, 'auth timeout'); } catch { /* indo */ } } }, 15_000);
    authTimer.unref?.();
    const onAgentFrame = async (raw: import('ws').RawData) => {
      if (!st.authed && rawLength(raw) > AGENT_PREAUTH_MAX) { try { ws.close(4413, 'pre-auth frame too large'); } catch { /* indo */ } return; }
      let m: { t?: string; agentId?: string; sig?: string; code?: string; publicKey?: string; label?: unknown } = {};
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!st.authed) {
        if (++attempts > 10) { try { ws.close(4429, 'too many attempts'); } catch { /* indo */ } return; }
        // Pairing: consome o código (atômico) → registra o agente → devolve agentId.
        if (m.t === 'pair' && typeof m.code === 'string' && typeof m.publicKey === 'string') {
          // Checked BEFORE consuming the single-use code: a bad key must not burn it.
          if (!isEd25519Spki(m.publicKey)) { ws.close(4400, 'invalid public key'); return; }
          const accountId = await cfg.store.consumePairingCode(m.code);
          if (!accountId) { ws.close(4401, 'invalid code'); return; }
          // /pair/new already refuses at the cap; this catches codes issued in parallel.
          if ((await cfg.store.listBoxes(accountId)).length >= maxBoxes) { ws.close(4429, 'box limit'); return; }
          const agentId = await cfg.store.createAgent(accountId, m.publicKey, sanitizeBoxLabel(m.label));
          if (!agentId) { ws.close(4500, 'pair failed'); return; }
          boxRows.delete(accountId);
          ws.send(JSON.stringify({ t: 'paired', agentId }));
          void sendBoxes(accountId);
          return;
        }
        if (m.t === 'agent-hello' && typeof m.agentId === 'string') {
          // One hello per socket. A second hello pending across the await below
          // could land AFTER agent-auth had bound the socket to its own account and
          // overwrite st.accountId: that agent's frames then went to another
          // account's browsers (it only needed the victim's agent id).
          if (st.challenge || st.helloPending) { ws.close(4401, 'hello twice'); return; }
          st.helloPending = true;
          const rec = await cfg.store.agentById(m.agentId);
          st.helloPending = false;
          if (st.authed || ws.readyState !== WebSocket.OPEN) return;
          if (!rec) { ws.close(4401, 'unknown agent'); return; }
          st.agentId = m.agentId; st.accountId = rec.accountId; st.challenge = makeChallenge();
          st.rank = rec.pairedAt ? Date.parse(rec.pairedAt) || Infinity : Infinity;
          (st as AgentState & { pub?: string }).pub = rec.publicKey;
          ws.send(JSON.stringify({ t: 'challenge', nonce: st.challenge }));
          return;
        }
        if (m.t === 'agent-auth' && typeof m.sig === 'string') {
          const pub = (st as AgentState & { pub?: string }).pub ?? '';
          // Verifica sobre challenge+agentId (domain separation; casa com o agente).
          if (!st.challenge || !verifyAgentSignature(pub, `${st.challenge}.${st.agentId}`, m.sig)) { ws.close(4401, 'bad sig'); return; }
          // Each box has its own slot: another box of the account is not a conflict.
          // The SAME agent reconnecting (old socket half-open) takes its slot over.
          if (ws.readyState !== ws.OPEN) return;
          st.authed = true;
          clearTimeout(authTimer);
          const prevPrimary = registry.primary(st.accountId);
          const prevAgent = registry.bindAgent(st.accountId, st.agentId, ws, st.rank);
          if (prevAgent) { try { (prevAgent as WebSocket).terminate(); } catch { /* já indo */ } }
          // An earlier-paired box coming back takes the primary over: tabs following
          // the primary were sealed with the other box and must redial.
          if (prevPrimary && prevPrimary !== st.agentId && registry.primary(st.accountId) === st.agentId) {
            const oldPrimary = registry.agentSocket(st.accountId, prevPrimary);
            for (const [tab, box] of registry.tabsOf(st.accountId, st.agentId)) {
              if (box) continue;
              // Its close handler will tell the NEW primary; the old one held the
              // sealed channel and must drop it now.
              for (const [c, conn] of conns) if (conn.ws === tab) { try { oldPrimary?.send(JSON.stringify({ t: 'e2e-gone', c })); } catch { /* indo */ } }
              try { (tab as WebSocket).close(4003, 'primary box changed'); } catch { /* indo */ }
            }
          }
          // agent-ready BEFORE the DB write: the socket is already bound, so browser
          // frames route to it from here on, and the agent ignores everything until
          // agent-ready — up to 10 s of `send`s were dropped with no agent-offline.
          ws.send(JSON.stringify({ t: 'agent-ready' }));
          void cfg.store.markAgentSeen(st.agentId).catch(() => { /* last-seen stamp only */ });
          // Avisa as abas que alcançam ESTE box que ele ficou online.
          registry.toBrowsers(st.accountId, st.agentId, JSON.stringify({ t: 'agent-online', box: st.agentId }));
          // Estado inicial de presença: liga os loops só se já houver aba olhando este box.
          flushPresence(st.accountId);
          void sendBoxes(st.accountId);
          return;
        }
        ws.close(4401, 'auth required'); return;
      }
      // Frame de controle do agente: 'agent-caps' reporta a capacidade LOCAL (bypass).
      // É consumido aqui (não repassado) e reemite caps pra cada aba já conectada,
      // casando o papel privilegiado dela com a capacidade real do agente.
      const s = raw.toString();
      if (maybeControlFrame(s, 'agent-caps')) {
        let m: { t?: string; canBypass?: boolean } = {};
        try { m = JSON.parse(s); } catch { /* repassa abaixo */ }
        if (m.t === 'agent-caps') {
          agentBypass.set(st.agentId, !!m.canBypass);
          for (const [b] of registry.tabsOf(st.accountId, st.agentId)) {
            const role = (b as BrowserSock)._role;
            if (role) b.send(capsFrame(role, st.agentId));
          }
          return;
        }
      }
      // Sealed frame for one tab: `{"c":"<22 chars>","p":0|1,...`. Routed by the
      // prefix alone (frames run to 32MB; no parse on the hot path), and only to
      // a tab of this agent's own account. The `c` is stripped: the tab never
      // needs it and must not learn other tabs' ids.
      const directed = /^\{"c":"([A-Za-z0-9_-]{22})"(?:,"p":([01]))?,/.exec(s.slice(0, 40));
      if (directed) {
        const conn = conns.get(directed[1]);
        if (conn && conn.accountId === st.accountId) registry.toBrowser(st.accountId, st.agentId, conn.ws, `{${s.slice(directed[0].length)}`, directed[2] === '1');
        return;
      }
      // Autenticado: frame do agente → só as abas que alcançam ESTE box.
      registry.toBrowsers(st.accountId, st.agentId, s);
    };
    // Todo o handshake (pair, agent-hello, agent-auth) aguarda o store. Rejeição
    // solta aqui derrubaria o processo inteiro; fecha só ESTE socket — o agente
    // reconecta com backoff.
    ws.on('message', (raw) => {
      onAgentFrame(raw).catch((e) => {
        console.error('[relay] agent frame:', e);
        try { ws.close(4500, 'store error'); } catch { /* indo */ }
      });
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      // Só emite agent-offline / apaga bypass se ESTE socket ainda era o agente
      // vinculado. Socket VELHO substituído no rebind (eviction) → unbindAgent false →
      // não derruba o agente NOVO nem manda offline espúrio logo após o online dele.
      if (!st.authed) return;
      const tabs = registry.tabsOf(st.accountId, st.agentId);
      if (!registry.unbindAgent(st.accountId, st.agentId, ws)) return;
      agentBypass.delete(st.agentId);
      const next = registry.primary(st.accountId);
      for (const [tab, box] of tabs) {
        // A tab following the primary had its sealed channel with THIS box: when
        // another box becomes primary it must redial and handshake with that one.
        if (!box && next) { try { (tab as WebSocket).close(4003, 'primary box changed'); } catch { /* indo */ } continue; }
        try { tab.send(JSON.stringify({ t: 'agent-offline', box: box || null })); } catch { /* indo */ }
      }
      flushPresence(st.accountId);
      void sendBoxes(st.accountId);
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0];
    const target = path === '/agent' ? wssAgent : path === '/ws' ? wssBrowser : null;
    if (!target) { socket.destroy(); return; }
    // Browsers always send Origin; a cross-site page must not open a socket with the
    // user's token. Agents send none (allowed); a foreign Origin on /agent is rejected too.
    if (!originAllowed(origins, req.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nconnection: close\r\ncontent-length: 0\r\n\r\n');
      return;
    }
    const release = acquireIp(clientIp(req));
    if (!release) {
      socket.end('HTTP/1.1 429 Too Many Requests\r\nconnection: close\r\ncontent-length: 0\r\n\r\n');
      return;
    }
    socket.once('close', release);
    target.handleUpgrade(req, socket, head, (ws) => target.emit('connection', ws, req));
  });

  // Heartbeat: termina sockets meio-abertos (laptop dormindo, sem FIN) em ambos os
  // servidores — sem isto o buffer de um cliente morto cresce até o OOM, e um agente
  // morto fica "online" engolindo frames. Espelha o sweep do server/ws.ts.
  for (const w of [wssBrowser, wssAgent]) {
    // An 'error' with no listener is thrown by Node: one malformed frame (unmasked,
    // bad opcode) or an over-limit one (1009) from ANY client, authenticated or
    // not, killed the relay and dropped every account. ws closes the socket after
    // emitting it; logging is all that is left to do.
    w.on('error', (e: Error) => console.error('[relay] wss error:', e.message));
    w.on('connection', (ws: WebSocket) => {
      ws.on('error', (e: Error) => console.error('[relay] ws error:', e.message));
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

  // server.close() waits for every open connection, and WebSockets never end on
  // their own: without terminating them first, SIGTERM hung until systemd's
  // SIGKILL (~90s offline per restart instead of a few seconds). Agents and tabs
  // reconnect with backoff.
  const shutdown = (done: () => void) => {
    clearInterval(beat);
    for (const w of [wssBrowser, wssAgent]) for (const c of w.clients) { try { c.terminate(); } catch { /* going */ } }
    server.close(() => done());
  };

  return { server, registry, shutdown };
}

// Pré-filtro BARATO: só decide se vale gastar um JSON.parse. Os frames de DADOS
// chegam a 32MB (upload em base64, conteúdo de sessão) e parsear todos por causa de
// um punhado de frames de controle — que têm dezenas de bytes — sairia caro. O teto
// descarta os grandes sem varrer a string; quem passa daqui ainda tem o `t` conferido.
const CONTROL_FRAME_MAX = 4096;

export function maybeControlFrame(s: string, ...types: string[]): boolean {
  if (s.length > CONTROL_FRAME_MAX) return false;
  return types.some((t) => s.includes(`"${t}"`));
}

// new Date()/Date.now() ficam num único ponto pra não espalhar dependência de tempo.
function nowMs(): number { return Date.now(); }

// Comparação de segredo em tempo constante. `===` em string vaza o tamanho do
// prefixo correto pelo tempo de resposta, e o /status é público — dá pra sondar à
// vontade. Segredo não configurado nega sempre.
// Compares sha256 digests (always 32 bytes) so a length mismatch takes the same
// path as a byte mismatch and does not leak the secret's length.
export function secretEquals(expected: string | undefined, got: string): boolean {
  if (!expected) return false;
  return timingSafeEqual(sha256(expected), sha256(got));
}

function sha256(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest();
}
