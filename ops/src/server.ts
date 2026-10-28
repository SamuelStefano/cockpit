import type { IncomingMessage, ServerResponse } from 'node:http';
import { login, type LoginDeps } from './auth.ts';
import { CSS } from './css.ts';
import { UUID, type OpsData } from './data.ts';
import { clearedCookie, readCookie, SESSION_COOKIE, sessionCookie, signSession, verifySession } from './session.ts';
import { boxesPage, errorPage, type Health, loginPage, reportPage, reportsPage } from './views.ts';

export const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cache-control': 'no-store',
};

export interface AppDeps {
  sessionSecret: string;
  adminIds: Set<string>;
  publicOrigin: string;
  login: LoginDeps;
  data: OpsData;
  health: () => Promise<Health>;
  now: () => number;
  log?: (msg: string) => void;
}

const KIND = /^[a-z][a-z0-9_-]{0,39}$/;
const SOURCES = new Set(['browser', 'agent', 'relay']);
const BODY_MAX = 4096;
const GENERIC_LOGIN_ERROR = 'Não foi possível entrar. Confira email e senha, ou tente mais tarde.';

// The proxy (Traefik on Dokploy) appends the address it saw, so the last hop is the
// one a client cannot forge.
export function clientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff.join(',') : xff;
  const last = raw?.split(',').map((s) => s.trim()).filter(Boolean).pop();
  return last || req.socket.remoteAddress || 'unknown';
}

function sameOrigin(req: IncomingMessage, origin: string): boolean {
  const o = req.headers.origin;
  if (o) return o === origin;
  const ref = req.headers.referer;
  return typeof ref === 'string' && (ref === origin || ref.startsWith(`${origin}/`));
}

async function readBody(req: IncomingMessage): Promise<string | null> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > BODY_MAX) return null;
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

const redirect = (res: ServerResponse, to: string, headers: Record<string, string> = {}) => send(res, 303, '', { location: to, ...headers });

export function createHandler(deps: AppDeps): (req: IncomingMessage, res: ServerResponse) => void {
  const log = deps.log ?? ((m: string) => console.error(m));
  const userOf = (req: IncomingMessage): string | null => {
    const id = verifySession(deps.sessionSecret, readCookie(req.headers.cookie, SESSION_COOKIE), deps.now());
    // Removing someone from ADMIN_USER_IDS ends their session on the next request.
    return id && deps.adminIds.has(id) ? id : null;
  };

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    if (path === '/healthz' && method === 'GET') return send(res, 200, 'ok', { 'content-type': 'text/plain; charset=utf-8' });
    if (path === '/ops.css' && method === 'GET') return send(res, 200, CSS, { 'content-type': 'text/css; charset=utf-8' });

    if (method === 'POST') {
      if (!sameOrigin(req, deps.publicOrigin)) return send(res, 403, errorPage(403, 'Origem recusada.', null));
      if (path === '/logout') return redirect(res, '/login', { 'set-cookie': clearedCookie() });
      if (path === '/login') {
        const raw = await readBody(req);
        if (raw === null) return send(res, 413, errorPage(413, 'Corpo grande demais.', null));
        const form = new URLSearchParams(raw);
        const r = await login(deps.login, clientIp(req), (form.get('email') ?? '').trim(), form.get('password') ?? '');
        if (!r.ok) {
          if (r.reason === 'error') log('login: auth backend error');
          return send(res, r.reason === 'rate' ? 429 : 401, loginPage(GENERIC_LOGIN_ERROR));
        }
        return redirect(res, '/reports', { 'set-cookie': sessionCookie(signSession(deps.sessionSecret, r.userId, deps.now())) });
      }
      return send(res, 405, errorPage(405, 'Método não permitido.', null));
    }
    if (method !== 'GET' && method !== 'HEAD') return send(res, 405, errorPage(405, 'Método não permitido.', null));

    if (path === '/login') return userOf(req) ? redirect(res, '/reports') : send(res, 200, loginPage(null));
    if (!userOf(req)) return redirect(res, '/login');
    if (path === '/') return redirect(res, '/reports');

    const now = deps.now();
    if (path === '/reports') {
      const [health, emails, agents] = await Promise.all([deps.health(), deps.data.emails(), deps.data.listAgents()]);
      const q = (k: string) => url.searchParams.get(k)?.trim().slice(0, 200) || undefined;
      const filters = { email: q('email'), source: q('source'), kind: q('kind'), box: q('box') };
      const source = filters.source && SOURCES.has(filters.source) ? filters.source : undefined;
      const kind = filters.kind && KIND.test(filters.kind) ? filters.kind : undefined;
      let accountIds: string[] | undefined;
      if (filters.email) {
        const needle = filters.email.toLowerCase();
        accountIds = [...emails].filter(([, e]) => e.toLowerCase().includes(needle)).map(([id]) => id);
      }
      let boxIds: string[] | undefined;
      if (filters.box) {
        const needle = filters.box.toLowerCase();
        boxIds = UUID.test(needle) ? [needle] : agents.filter((a) => a.label.toLowerCase().includes(needle)).map((a) => a.id);
      }
      const empty = (accountIds && !accountIds.length) || (boxIds && !boxIds.length) || (filters.kind && !kind) || (filters.source && !source);
      const rows = empty ? [] : await deps.data.listReports({ accountIds, boxIds, source, kind, limit: 100 });
      const labels = new Map(agents.map((a) => [a.id, a.label]));
      return send(res, 200, reportsPage({ rows, emails, labels, filters, now, health }));
    }
    const m = /^\/reports\/([0-9a-f-]{36})$/.exec(path);
    if (m) {
      const [health, report] = await Promise.all([deps.health(), deps.data.getReport(m[1])]);
      if (!report) return send(res, 404, errorPage(404, 'Relatório não encontrado.', health));
      const [emails, agents] = await Promise.all([deps.data.emails(), deps.data.listAgents()]);
      const label = agents.find((a) => a.id === report.box_id)?.label ?? '';
      return send(res, 200, reportPage(report, emails.get(report.account_id) ?? '', label, now, health));
    }
    if (path === '/boxes') {
      const [health, emails, agents] = await Promise.all([deps.health(), deps.data.emails(), deps.data.listAgents()]);
      return send(res, 200, boxesPage(agents, emails, now, health));
    }
    return send(res, 404, errorPage(404, 'Página não encontrada.', null));
  }

  return (req, res) => {
    route(req, res).catch((e: unknown) => {
      log(`request failed: ${(e as Error)?.message ?? e}`);
      if (!res.headersSent) send(res, 500, errorPage(500, 'Erro interno.', null));
      else res.end();
    });
  };
}
