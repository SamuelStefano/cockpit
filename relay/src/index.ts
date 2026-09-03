import { createServer, type IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './routing';
import {
  makeJwks, verifyJwtSignature, validateClaims, makeChallenge, verifyAgentSignature,
  type JwksFn, type Identity,
} from './verify';
import { slidingWindow } from './throttle';
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
  // Segredo do /status detalhado (DECK_STATUS_TOKEN). Ausente = só o corpo público.
  statusToken?: string;
  // Override da resolução de identidade do browser (default: JWT via JWKS). Existe
  // só pra TESTE de integração local (stub) — em prod fica undefined = JWKS real.
  resolveIdentity?: (token: string | null) => Promise<Identity | null>;
}

const tokenFromUrl = (url: string | undefined): string | null => {
  try { return new URL(url ?? '', 'http://x').searchParams.get('token'); } catch { return null; }
};

interface AgentState { agentId: string; accountId: string; challenge: string; authed: boolean }

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
  const jwks: JwksFn = makeJwks(cfg.jwksUrl);
  const pairThrottle = slidingWindow(5, 60_000);

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
      return validateClaims(payload, { iss: cfg.iss, nowSec: Math.floor(nowMs() / 1000), rootEmails: roots, isAdmin });
    } catch (e) {
      console.error('[relay] identityFrom:', e);
      return null;
    }
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
        const code = await cfg.store.createPairingCode(id.accountId);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code }));
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
  const wssBrowser = new WebSocketServer({ noServer: true, maxPayload: cfg.maxPayload ?? 32 * 1024 * 1024 });
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

    const id = await identityFrom(tokenFromUrl(req.url));
    clearTimeout(authTimer);
    if (!id) { ws.close(4401, 'auth'); return; }            // default-deny (red line #10)
    const accountId = id.accountId;
    (ws as BrowserSock)._role = id.role;                     // pra reemitir caps no agent-caps
    // Primeira aba da conta (0→1) → avisa o agente que há alguém olhando (liga loops).
    if (registry.addBrowser(accountId, ws)) registry.toAgent(accountId, JSON.stringify({ t: 'browsers-present' }));
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
      if (maybeControlFrame(s, 'accounts-list', 'set-admin')) {
        let m: { t?: string; accountId?: string; admin?: boolean } = {};
        try { m = JSON.parse(s); } catch { m = {}; }
        // O pré-filtro é por SUBSTRING (evitar JSON.parse em todo frame, que chega a
        // 32MB de base64 em upload). Ele acerta em qualquer frame que só MENCIONE o
        // texto — um chat perguntando sobre "accounts-list". Se o `t` não for de
        // administração, o frame CAI FORA daqui e segue pro agente; engolir aqui era
        // uma mensagem sumindo em silêncio.
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
        // Frame de administração malformado/negado nunca é repassado: o agente não
        // fala com o banco e não teria o que fazer com ele.
        if (m.t === 'accounts-list' || m.t === 'set-admin') return;
      }
      // Roteia opaco pro agente DAQUELA conta. A autenticidade fim-a-fim do frame
      // (assinatura, T5) é verificada NO AGENTE, não aqui — o relay não confia em si.
      if (!registry.toAgent(accountId, s)) ws.send(JSON.stringify({ t: 'agent-offline' }));
    };

    // `onFrame` chama o store (accounts-list/set-admin). Rejeição solta num handler
    // de evento = unhandledRejection = processo morto. Falhou = não responde.
    const feed = (s: string) => { onFrame(s).catch((e) => console.error('[relay] browser frame:', e)); };
    ws.off('message', buffer);
    ws.on('message', (data) => feed(data.toString()));
    for (const s of early) feed(s);           // drena na ordem de chegada
    // Última aba (1→0) → avisa o agente que ninguém está olhando (pausa loops).
    ws.on('close', () => { if (registry.removeBrowser(accountId, ws)) registry.toAgent(accountId, JSON.stringify({ t: 'no-browsers' })); });
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
          // Termina um socket de agente ANTERIOR da mesma conta (reconnect com o velho
          // meio-aberto) — senão os dois coexistiam empurrando frames até o heartbeat.
          const prevAgent = registry.bindAgent(st.accountId, ws);
          if (prevAgent) { try { (prevAgent as WebSocket).terminate(); } catch { /* já indo */ } }
          await cfg.store.markAgentSeen(st.agentId);
          ws.send(JSON.stringify({ t: 'agent-ready' }));
          // Avisa as abas da conta que o agente ficou online.
          registry.toBrowsers(st.accountId, JSON.stringify({ t: 'agent-online' }));
          // Estado inicial de presença pro agente recém-pareado: liga os loops só se
          // já houver aba aberta (senão ficam pausados até a 1ª aba conectar).
          ws.send(JSON.stringify({ t: registry.browserCount(st.accountId) > 0 ? 'browsers-present' : 'no-browsers' }));
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
      if (st.authed && registry.unbindAgent(st.accountId, ws)) {
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
export function secretEquals(expected: string | undefined, got: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(expected), b = Buffer.from(got);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
