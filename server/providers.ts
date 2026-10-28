import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { classifyProbeModel, PROBE_ENDPOINT_MAX, PROBE_KEY_MAX, type ProbeResult } from '../shared/provider-probe';

const TIMEOUT_MS = 6000;
const MAX_BODY = 1024 * 1024;
const MAX_MODELS = 200;
const MAX_CONCURRENT = 3;

const BLOCKED_HOSTS: ReadonlySet<string> = new Set(['metadata', 'metadata.google.internal', 'instance-data', 'instance-data.ec2.internal']);

function v4Parts(ip: string): number[] | null {
  const p = ip.split('.').map(Number);
  return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? p : null;
}

// Loopback and private ranges stay allowed on purpose: Ollama, LM Studio and vLLM
// run there. Link-local (cloud metadata), multicast, unspecified and reserved do not.
export function isBlockedAddress(raw: string): boolean {
  let ip = raw.toLowerCase().replace(/^\[|\]$/g, '');
  const zone = ip.indexOf('%');
  if (zone >= 0) ip = ip.slice(0, zone);
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) ip = mapped[1];
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    ip = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  const v4 = v4Parts(ip);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b === 100 && v4[2] === 100 && v4[3] === 200) return true;
    return false;
  }
  if (isIP(ip) === 6) {
    if (ip === '::') return true;
    if (/^fe[89ab]/.test(ip)) return true;
    if (ip.startsWith('ff')) return true;
    if (ip === 'fd00:ec2::254') return true;
    return false;
  }
  return true;
}

export type EndpointCheck = { ok: true; url: URL } | { ok: false; error: string };

export function parseEndpoint(raw: unknown): EndpointCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'Endereço inválido.' };
  const text = raw.trim();
  if (!text || text.length > PROBE_ENDPOINT_MAX) return { ok: false, error: 'Endereço inválido.' };
  let url: URL;
  try { url = new URL(text); } catch { return { ok: false, error: 'Endereço inválido. Use algo como https://servidor/v1.' }; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: 'Só endereços http ou https.' };
  if (url.username || url.password) return { ok: false, error: 'Não coloque usuário ou senha no endereço. Use o campo Chave.' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || BLOCKED_HOSTS.has(host)) return { ok: false, error: 'Esse endereço não é permitido.' };
  if (isIP(host.replace(/^\[|\]$/g, '')) && isBlockedAddress(host)) return { ok: false, error: 'Esse endereço não é permitido.' };
  url.hash = '';
  url.search = '';
  return { ok: true, url };
}

function modelsUrl(url: URL): URL {
  const out = new URL(url.toString());
  const path = out.pathname.replace(/\/+$/, '');
  out.pathname = path.endsWith('/models') ? path : `${path}/models`;
  return out;
}

async function resolveSafe(host: string): Promise<{ address: string; family: number } | { error: string }> {
  const bare = host.replace(/^\[|\]$/g, '');
  const ver = isIP(bare);
  if (ver) return { address: bare, family: ver };
  let found: { address: string; family: number }[];
  try { found = await dnsLookup(bare, { all: true, verbatim: true }); } catch { return { error: 'Não encontrei esse endereço.' }; }
  if (!found.length || found.some((f) => isBlockedAddress(f.address))) return { error: 'Esse endereço não é permitido.' };
  return found[0];
}

interface Fetched { status: number; body: string; tooBig: boolean }

function fetchPinned(url: URL, pinned: { address: string; family: number }, key: string): Promise<Fetched | { error: string }> {
  return new Promise((resolve) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    let settled = false;
    const done = (v: Fetched | { error: string }) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    const headers: Record<string, string> = { accept: 'application/json', 'user-agent': 'deck-probe' };
    if (key) headers.authorization = `Bearer ${key}`;
    const req = request(url, {
      method: 'GET',
      headers,
      lookup: ((_h: string, opts: { all?: boolean }, cb: (...a: unknown[]) => void) => {
        if (opts?.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
        else cb(null, pinned.address, pinned.family);
      }) as never,
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) { req.destroy(); done({ status: res.statusCode ?? 0, body: '', tooBig: true }); return; }
        chunks.push(c);
      });
      res.on('end', () => done({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), tooBig: false }));
      res.on('error', () => done({ error: 'Não consegui conectar.' }));
    });
    const timer = setTimeout(() => { req.destroy(); done({ error: 'O servidor demorou demais para responder.' }); }, TIMEOUT_MS);
    req.on('error', () => done({ error: 'Não consegui conectar.' }));
    req.end();
  });
}

function idsFrom(body: string): string[] | null {
  let j: unknown;
  try { j = JSON.parse(body); } catch { return null; }
  const list = Array.isArray(j) ? j : (j as { data?: unknown; models?: unknown } | null)?.data ?? (j as { models?: unknown } | null)?.models;
  if (!Array.isArray(list)) return null;
  const ids: string[] = [];
  for (const it of list) {
    const id = typeof it === 'string' ? it : (it as { id?: unknown; name?: unknown } | null)?.id ?? (it as { name?: unknown } | null)?.name;
    if (typeof id === 'string' && id && id.length <= 128 && !/[\u0000-\u001f]/.test(id)) ids.push(id);
    if (ids.length >= MAX_MODELS) break;
  }
  return ids;
}

let inFlight = 0;

export async function probe(endpoint: unknown, key?: unknown): Promise<ProbeResult> {
  const parsed = parseEndpoint(endpoint);
  if (!parsed.ok) return parsed;
  let token = '';
  if (key !== undefined && key !== null && key !== '') {
    if (typeof key !== 'string' || key.length > PROBE_KEY_MAX || /[\u0000-\u001f\u007f\s]/.test(key)) return { ok: false, error: 'Chave inválida.' };
    token = key;
  }
  if (inFlight >= MAX_CONCURRENT) return { ok: false, error: 'Muitos testes ao mesmo tempo. Tente de novo em instantes.' };
  inFlight += 1;
  try {
    const pinned = await resolveSafe(parsed.url.hostname);
    if ('error' in pinned) return { ok: false, error: pinned.error };
    const res = await fetchPinned(modelsUrl(parsed.url), pinned, token);
    if ('error' in res) return { ok: false, error: res.error };
    if (res.status >= 300 && res.status < 400) return { ok: false, error: 'O endereço redirecionou para outro lugar. Use o endereço final.' };
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'O servidor recusou a chave.' };
    if (res.status < 200 || res.status >= 300) return { ok: false, error: 'O servidor respondeu com erro.' };
    if (res.tooBig) return { ok: false, error: 'Resposta grande demais.' };
    const ids = idsFrom(res.body);
    if (!ids) return { ok: false, error: 'A resposta não parece de um servidor compatível com OpenAI.' };
    if (!ids.length) return { ok: false, error: 'Conectou, mas o servidor não lista nenhum modelo.' };
    return { ok: true, models: ids.map(classifyProbeModel) };
  } finally {
    inFlight -= 1;
  }
}
