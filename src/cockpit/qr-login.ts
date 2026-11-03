import { relayHttpBase } from './session';

// Sign-in by QR. Two fragment params, never sent to a server:
//   login=<ticket>   minted by a signed-in device, redeemed here for a session
//   qrlogin=<id>     a login screen elsewhere asks this signed-in device to approve
// Both are lifted out of the address bar on load and kept in this tab only.

export const QR_TICKET_KEY = 'deck.qr-ticket';
export const QR_APPROVE_KEY = 'deck.qr-approve';
const KEY_RE = /^[A-Za-z0-9_-]{43}$/;

export const isQrKey = (v: unknown): v is string => typeof v === 'string' && KEY_RE.test(v);

interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
interface Loc { pathname: string; search: string; hash: string }
interface Hist { replaceState(data: unknown, unused: string, url: string): void }

const params = (hash: string) => new URLSearchParams(hash.replace(/^#/, ''));

// Runs before the enroll-link capture: a link carrying an enroll code too keeps
// its fragment so that capture can read it (and strip it) next.
export function captureQrLogin(loc: Loc, hist: Hist, store: KV): void {
  const p = params(loc.hash);
  if (!p.has('login') && !p.has('qrlogin')) return;
  const put = (k: string, v: string | null) => { try { if (isQrKey(v)) store.setItem(k, v); } catch { /* not kept */ } };
  put(QR_TICKET_KEY, p.get('login'));
  put(QR_APPROVE_KEY, p.get('qrlogin'));
  if (!p.has('enroll')) hist.replaceState(null, '', loc.pathname + loc.search);
}

export function readQrKey(store: KV, key: string): string | null {
  try { const v = store.getItem(key); return isQrKey(v) ? v : null; } catch { return null; }
}

export function clearQrKey(store: KV, key: string): void {
  try { store.removeItem(key); } catch { /* nothing kept */ }
}

export const qrApproveUrl = (origin: string, id: string) => `${origin}/#qrlogin=${id}`;

type Fetch = typeof fetch;

async function post(route: string, body: unknown, token?: string, f: Fetch = fetch): Promise<Response> {
  return f(`${relayHttpBase()}/auth/qr/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
}

export async function mintTicket(token: string, f?: Fetch): Promise<string | null> {
  try {
    const r = await post('ticket', {}, token, f);
    if (!r.ok) return null;
    const j = await r.json() as { ticket?: unknown };
    return isQrKey(j.ticket) ? j.ticket : null;
  } catch { return null; }
}

export async function redeemTicket(ticket: string, f?: Fetch): Promise<string | null> {
  try {
    const r = await post('redeem', { ticket }, undefined, f);
    if (!r.ok) return null;
    const j = await r.json() as { tokenHash?: unknown };
    return typeof j.tokenHash === 'string' && j.tokenHash ? j.tokenHash : null;
  } catch { return null; }
}

export interface QrRequest { id: string; secret: string; code: string; expiresAt: number }

export async function openRequest(f?: Fetch): Promise<QrRequest | null> {
  try {
    const r = await post('request', {}, undefined, f);
    if (!r.ok) return null;
    const j = await r.json() as Partial<QrRequest>;
    return isQrKey(j.id) && isQrKey(j.secret) && typeof j.code === 'string' && /^\d{4}$/.test(j.code) && typeof j.expiresAt === 'number'
      ? { id: j.id, secret: j.secret, code: j.code, expiresAt: j.expiresAt } : null;
  } catch { return null; }
}

export type PollOutcome = { status: 'pending' } | { status: 'approved'; tokenHash: string } | { status: 'gone' } | { status: 'error' };

export async function pollRequest(req: QrRequest, f?: Fetch): Promise<PollOutcome> {
  try {
    const r = await post('poll', { id: req.id, secret: req.secret }, undefined, f);
    if (r.status === 410) return { status: 'gone' };
    if (!r.ok) return { status: 'error' };
    const j = await r.json() as { status?: string; tokenHash?: unknown };
    if (j.status === 'approved' && typeof j.tokenHash === 'string' && j.tokenHash) return { status: 'approved', tokenHash: j.tokenHash };
    return { status: 'pending' };
  } catch { return { status: 'error' }; }
}

export async function peekRequest(token: string, id: string, f?: Fetch): Promise<{ ua: string; expiresAt: number } | null> {
  try {
    const r = await post('peek', { id }, token, f);
    if (!r.ok) return null;
    const j = await r.json() as { ua?: unknown; expiresAt?: unknown };
    return { ua: typeof j.ua === 'string' ? j.ua : '', expiresAt: typeof j.expiresAt === 'number' ? j.expiresAt : 0 };
  } catch { return null; }
}

export type AnswerOutcome = 'ok' | 'bad-code' | 'gone';

export async function answerRequest(token: string, id: string, approve: boolean, code: string, f?: Fetch): Promise<AnswerOutcome> {
  try {
    const r = await post('answer', approve ? { id, approve, code } : { id, approve }, token, f);
    return r.ok ? 'ok' : r.status === 422 ? 'bad-code' : 'gone';
  } catch { return 'gone'; }
}

// One-shot work keyed by a single-use value: a StrictMode remount (or any
// second mount) joins the same promise instead of spending the value twice.
const once = new Map<string, Promise<unknown>>();
export function runOnce<T>(key: string, work: () => Promise<T>): Promise<T> {
  let p = once.get(key) as Promise<T> | undefined;
  if (!p) { p = work(); once.set(key, p); }
  return p;
}

// "iPhone · Safari" from a raw user agent; enough for a person to recognise it.
export function describeUa(ua: string): string {
  const os = /iPhone|iPad|Android|Windows|Mac OS X|Linux|CrOS/.exec(ua)?.[0]?.replace('Mac OS X', 'Mac') ?? 'aparelho desconhecido';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}
