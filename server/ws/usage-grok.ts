import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { PlanUsage } from '../../shared/protocol';
import { readGrokToken } from '../grok-auth';
import { broadcast } from './broadcast';
import { budgetNextReadAt, GAP_MIN_MS, paceMs, pruneAttempts, RATE_JITTER_MS, retryAfterMs, type FetchOutcome } from './usage-plan';

// Créditos do plano do Grok, no mesmo ritmo do poller do Claude (usage-plan.ts):
// orçamento por hora gravado em disco e dividido entre ws.ts e agent.ts, 429 com
// Retry-After respeitado, uma leitura depois do settle do turno. Mais simples que
// o do Claude de propósito: ainda não há histórico de 429 desta conta pra ensinar
// um orçamento, então ele é fixo e conservador.
// SEGURANÇA: o token de ~/.grok/auth.json só vive neste processo; o cliente
// recebe só percentual e datas.
const BILLING_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits';
// O CLI se identifica assim; sem o header o proxy trata o bearer como de outro cliente.
const CLIENT_HEADER = { 'x-xai-token-auth': 'xai-grok-cli' };
export const GROK_BUDGET = 12;
const TICK_MS = 15_000;
// O proxy contabiliza o turno com atraso, igual à Anthropic.
const SETTLE_MS = 25_000;
const COOLDOWN_FALLBACK_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 90 * 60_000;
const cachePath = () => process.env.COCKPIT_GROK_USAGE ?? join(homedir(), '.cockpit', 'grok-plan-usage.json');

interface GrokCache { ts: number; usage: PlanUsage | null; cooldownUntil?: number; attempts?: number[] }

// O corpo vem de um serviço que não documenta o formato: contador int64 chega
// como string em JSON de protobuf, e data chega ISO ou epoch (s ou ms).
function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function when(v: unknown): number | null {
  const n = num(v);
  if (n !== null) return n > 0 ? (n < 1e12 ? n * 1000 : n) : null;
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

const valOf = (v: unknown) => num((v as { val?: unknown } | null)?.val ?? v);

// null = o corpo não diz quanto foi gasto. Nunca vira 0%: um verde confiante é
// exatamente o número inventado que o painel não pode mostrar.
export function mapGrokBilling(body: unknown): PlanUsage | null {
  const b = (body ?? {}) as { config?: Record<string, unknown> };
  const c = (b.config ?? body ?? {}) as Record<string, unknown>;
  let pct = num(c.creditUsagePercent);
  if (pct === null) {
    const used = valOf(c.onDemandUsed);
    const cap = valOf(c.onDemandCap);
    if (used !== null && cap !== null && cap > 0) pct = (used / cap) * 100;
  }
  if (pct === null) return null;
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const period = c.currentPeriod as { end?: unknown } | undefined;
  const resetsAt = when(period?.end) ?? when(c.billingPeriodEnd);
  return {
    fiveHour: p,
    sevenDay: p,
    resetsAt,
    sevenDayResetsAt: resetsAt,
    limits: [{ id: 'grok-credits', label: 'Créditos do período', pct: p, resetsAt, severity: 'normal', scoped: false }],
  };
}

export type GrokFetchOutcome = FetchOutcome | { kind: 'fail'; status?: number };

export async function fetchGrokUsage(token: string): Promise<GrokFetchOutcome> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(BILLING_URL, { headers: { authorization: `Bearer ${token}`, ...CLIENT_HEADER }, signal: ac.signal });
  } catch { return { kind: 'fail' }; } finally { clearTimeout(timer); }
  if (res.status === 429 || res.status === 529) {
    return { kind: 'rate', waitMs: retryAfterMs(res.headers.get('retry-after')) || COOLDOWN_FALLBACK_MS };
  }
  if (!res.ok) return { kind: 'fail', status: res.status };
  try {
    const usage = mapGrokBilling(await res.json());
    return usage ? { kind: 'ok', usage } : { kind: 'fail', status: res.status };
  } catch { return { kind: 'fail', status: res.status }; }
}

let last: PlanUsage | null = null;
let lastReadAt = 0;
let cooldownUntil = 0;
let attempts: number[] = [];
let refreshing = false;
let ownWriteTs = 0;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let loggedNoToken = false;

const log = (msg: string) => console.log(`[grok-usage] ${new Date().toISOString()} ${msg}`);

function readCache(): GrokCache | null {
  try {
    const o = JSON.parse(readFileSync(cachePath(), 'utf8'));
    return typeof o?.ts === 'number' ? (o as GrokCache) : null;
  } catch { return null; }
}

function patchCache(patch: Partial<GrokCache>): void {
  const prev = readCache();
  const next: GrokCache = { ts: prev?.ts ?? 0, usage: prev?.usage ?? last, ...(prev ?? {}), ...patch };
  try {
    const path = cachePath();
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(next), 'utf8');
    renameSync(tmp, path);
  } catch { /* cache é conforto */ }
}

// Disco vence a memória: o irmão pode ter lido (adota o número) ou levado 429
// (herda o bloqueio) desde a última volta deste processo.
function syncFromDisk(now: number): void {
  const e = readCache();
  if (!e) return;
  if (typeof e.cooldownUntil === 'number' && e.cooldownUntil > cooldownUntil) cooldownUntil = e.cooldownUntil;
  const disk = Array.isArray(e.attempts) ? e.attempts.filter((t) => typeof t === 'number') : [];
  attempts = pruneAttempts([...new Set([...attempts, ...disk])], now);
  if (e.usage && e.ts > lastReadAt && e.ts !== ownWriteTs && now - e.ts < CACHE_TTL_MS) {
    last = e.usage;
    lastReadAt = e.ts;
    emit();
  }
}

export function getLastGrokUsage() { return last; }

export function grokUsageNextReadAt(now = Date.now()): number {
  const fromBudget = budgetNextReadAt(attempts, GROK_BUDGET, now);
  const at = Math.max(cooldownUntil > now ? cooldownUntil : 0, fromBudget > now ? fromBudget : 0);
  return at;
}

export interface GrokUsageFrame { t: 'grok-usage'; usage: PlanUsage | null; blockedUntil: number | null; readAt: number | null; nextReadAt: number | null }

export function grokUsageFrame(now = Date.now(), always = false): GrokUsageFrame | null {
  const blocked = cooldownUntil > now ? cooldownUntil : 0;
  if (!last && !blocked && !always) return null;
  return { t: 'grok-usage', usage: last, blockedUntil: blocked || null, readAt: lastReadAt || null, nextReadAt: grokUsageNextReadAt(now) || null };
}

function emit(): void {
  const f = grokUsageFrame();
  if (f) broadcast(f);
}

function accept(usage: PlanUsage, now: number, via: string): void {
  last = usage;
  lastReadAt = now;
  ownWriteTs = now;
  cooldownUntil = 0;
  patchCache({ ts: now, usage, cooldownUntil: 0 });
  log(`${via} créditos=${usage.fiveHour}%`);
  emit();
}

// O ACP do Grok devolveu o próprio billing no fim do turno: número de graça,
// sem gastar o orçamento do endpoint.
export function noteGrokUsage(body: unknown): boolean {
  const usage = mapGrokBilling(body);
  if (!usage) return false;
  accept(usage, Date.now(), 'acp');
  return true;
}

export type GrokRefreshMode = 'idle' | 'active' | 'force';

// Single-flight. Resolve quando a volta termina (o teste espera por ela; o loop não).
export async function requestGrokUsageRefresh(mode: GrokRefreshMode = 'active'): Promise<void> {
  if (refreshing) return;
  const now = Date.now();
  syncFromDisk(now);
  // Um número mais novo que o espaçamento não muda lendo de novo — só gasta vaga.
  const pace = paceMs(GROK_BUDGET);
  const fresh = mode === 'force' ? GAP_MIN_MS : mode === 'idle' ? pace * 2 : pace;
  if (lastReadAt && now - lastReadAt < fresh) return;
  if (now < cooldownUntil) return;
  if (budgetNextReadAt(attempts, GROK_BUDGET, now) > now) return;
  const lastAttempt = attempts.length ? attempts[attempts.length - 1] : 0;
  if (mode !== 'force' && now - lastAttempt < fresh) return;
  refreshing = true;
  try {
    const token = await readGrokToken();
    if (!token) {
      if (!loggedNoToken) log('sem login do Grok (~/.grok/auth.json) — barra fica em "—"');
      loggedNoToken = true;
      return;
    }
    loggedNoToken = false;
    attempts = [...pruneAttempts(attempts, now), now];
    patchCache({ attempts });
    const r = await fetchGrokUsage(token);
    if (r.kind === 'ok') accept(r.usage, Date.now(), '200');
    else if (r.kind === 'rate') {
      cooldownUntil = Date.now() + r.waitMs + RATE_JITTER_MS;
      patchCache({ cooldownUntil });
      log(`429 retry-after=${Math.round(r.waitMs / 1000)}s`);
      emit();
    } else {
      // 401/404/corpo sem número: fica o último valor conhecido, que a barra já
      // pinta como velho quando passa da idade. Nada de percentual inventado.
      log(`leitura falhou (${'status' in r && r.status ? r.status : 'rede'}) — mantendo o último número`);
    }
  } finally { refreshing = false; }
}

// Turno do Grok fechou: UMA leitura, depois do settle.
export function noteGrokUsageChanged(): void {
  if (settleTimer) return;
  settleTimer = setTimeout(() => { settleTimer = null; void requestGrokUsageRefresh('active'); }, SETTLE_MS);
  settleTimer.unref?.();
}

export function startGrokUsageLoop(hasClients: () => boolean, hasActiveRun: () => boolean = () => false) {
  const e = readCache();
  if (e?.usage && Date.now() - e.ts < CACHE_TTL_MS) { last = e.usage; lastReadAt = e.ts; }
  setInterval(() => {
    if (!hasClients()) return;
    void requestGrokUsageRefresh(hasActiveRun() ? 'active' : 'idle');
  }, TICK_MS).unref();
}

export function resetGrokUsageForTest(): void {
  last = null; lastReadAt = 0; cooldownUntil = 0; attempts = []; refreshing = false; ownWriteTs = 0; loggedNoToken = false;
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
}
