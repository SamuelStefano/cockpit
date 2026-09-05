import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { PlanUsage, PlanLimit } from '../../shared/protocol';
import { broadcast } from './broadcast';
import { readOAuthToken, OAUTH_BETA } from '../oauth';

// Uso GLOBAL do plano (claude.ai/settings/usage). Lê o token OAuth do CLI
// (~/.claude/.credentials.json) e consulta o endpoint de usage da Anthropic.
// SEGURANÇA: o token NUNCA sai do servidor — só os números de utilização vão
// pro cliente. O arquivo é relido a cada poll pra pegar o token já renovado
// pelo CLI (que faz o refresh sozinho).
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
// 5min, não 60s: o endpoint tem orçamento BEM curto e cada 429 custa ~10min de
// cegueira (Retry-After da Anthropic). Pollar de minuto em minuto não deixava a
// barra mais fresca — deixava ela bloqueada quase o tempo todo.
const POLL_MS = 5 * 60_000;
// Falha transitória (rede/token sendo renovado) não pode deixar a barra em "—"
// por 60s até o próximo poll — retenta rápido algumas vezes antes de desistir.
const RETRY_MS = 8_000;
const RETRY_MAX = 3;
// 429 sem Retry-After legível: espera cega antes de tocar no endpoint de novo.
const COOLDOWN_FALLBACK_MS = 5 * 60_000;
// Piso entre duas idas à rede. `requestPlanUsageRefresh` é chamado a cada connect
// novo (snapshot) e a cada checagem de hold da fila (quota) — o single-flight só
// junta chamadas SIMULTÂNEAS, então em rajada isso virava dezenas de requests por
// minuto e o próprio endpoint nos derrubava com 429.
const MIN_GAP_MS = 15_000;
// Snapshot em disco: reiniciar o Deck no meio de um 429 longo (o Retry-After da
// Anthropic chega a ~40min) deixava a barra em "—" até o bloqueio passar, porque
// o último valor só existia na memória do processo morto. Vale enquanto for
// recente — número velho demais na barra engana mais do que ajuda.
const CACHE_PATH = process.env.COCKPIT_PLAN_USAGE ?? join(homedir(), '.cockpit', 'plan-usage.json');
const CACHE_TTL_MS = 30 * 60_000;
// O arquivo também é o rendez-vous entre os DOIS processos que pollam (ws.ts e
// agent.ts): quem acha ali um snapshot fresco de OUTRO processo adota em vez de
// ir à rede. Sem isso eram dois pollers independentes gastando o mesmo orçamento
// e se derrubando por 429 — a barra ficava velha justamente por pedir demais.
const LEASE_MS = 4 * 60_000;

let last: PlanUsage | null = null;
export function getLastPlanUsage() { return last; }

interface CacheEntry { ts: number; usage: PlanUsage }

// ts do último snapshot que ESTE processo escreveu: sem isso ele adotaria o
// próprio arquivo pra sempre e nunca mais buscaria nada.
let ownWriteTs = 0;

function saveCache(usage: PlanUsage): void {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    ownWriteTs = Date.now();
    const tmp = `${CACHE_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ ts: ownWriteTs, usage }), 'utf8');
    renameSync(tmp, CACHE_PATH);
  } catch { /* cache é conforto, não pode derrubar o poll */ }
}

function readCacheEntry(): CacheEntry | null {
  try {
    const o = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    if (typeof o?.ts !== 'number') return null;
    return { ts: o.ts, usage: o.usage as PlanUsage };
  } catch { return null; }
}

function loadCache(): PlanUsage | null {
  const e = readCacheEntry();
  if (!e || Date.now() - e.ts > CACHE_TTL_MS) return null;
  return e.usage;
}

// Snapshot recente escrito pelo processo irmão, ou null se não houver.
export function borrowedSnapshot(entry: CacheEntry | null, ownTs: number, now: number): PlanUsage | null {
  if (!entry || entry.ts === ownTs) return null;
  return now - entry.ts < LEASE_MS ? entry.usage : null;
}

function pct(v: unknown): number {
  const n = typeof v === 'number' ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseReset(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

type RawLimit = {
  kind?: string;
  group?: string;
  percent?: number;
  severity?: string;
  resets_at?: string;
  scope?: { model?: { display_name?: string | null } | null } | null;
};

const KIND_LABEL: Record<string, string> = {
  session: 'Sessão (5h)',
  weekly_all: 'Semanal',
  weekly_scoped: 'Semanal',
};

function severityOf(v: unknown): PlanLimit['severity'] {
  return v === 'critical' || v === 'warning' ? v : 'normal';
}

// O teto por modelo (ex.: Fable) chega como `weekly_scoped` e só se identifica
// pelo display_name dentro de `scope` — sem isso, duas linhas ficariam "Semanal".
function labelOf(l: RawLimit): string {
  const model = l.scope?.model?.display_name;
  if (model) return model;
  return KIND_LABEL[l.kind ?? ''] ?? l.kind ?? 'Limite';
}

function mapLimits(raw: unknown): PlanLimit[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const l = (item ?? {}) as RawLimit;
    return {
      id: `${l.kind ?? 'limit'}-${i}`,
      label: labelOf(l),
      pct: pct(l.percent),
      resetsAt: parseReset(l.resets_at),
      severity: severityOf(l.severity),
      scoped: l.kind === 'weekly_scoped',
    };
  });
}

export function mapPlanUsage(body: unknown): PlanUsage {
  const b = body as {
    five_hour?: { utilization?: number; resets_at?: string };
    seven_day?: { utilization?: number; resets_at?: string };
    limits?: unknown;
  };
  return {
    fiveHour: pct(b?.five_hour?.utilization),
    sevenDay: pct(b?.seven_day?.utilization),
    resetsAt: parseReset(b?.five_hour?.resets_at),
    sevenDayResetsAt: parseReset(b?.seven_day?.resets_at),
    limits: mapLimits(b?.limits),
  };
}

// Retry-After vem em segundos ou como HTTP-date. Sem ele (ou ilegível) devolve 0
// e quem chama aplica o fallback cego.
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (!header) return 0;
  const secs = Number(header.trim());
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - now) : 0;
}

// `rate` = a Anthropic mandou parar; insistir SÓ renova a punição.
export type FetchOutcome =
  | { kind: 'ok'; usage: PlanUsage }
  | { kind: 'rate'; waitMs: number }
  | { kind: 'fail' };

export async function fetchPlanUsage(): Promise<FetchOutcome> {
  const token = await readOAuthToken();
  if (!token) return { kind: 'fail' };
  let res: Response;
  try {
    res = await fetch(USAGE_URL, {
      headers: { authorization: `Bearer ${token}`, 'anthropic-beta': OAUTH_BETA },
    });
  } catch { return { kind: 'fail' }; }
  if (res.status === 429 || res.status === 529) {
    return { kind: 'rate', waitMs: retryAfterMs(res.headers.get('retry-after')) || COOLDOWN_FALLBACK_MS };
  }
  if (!res.ok) return { kind: 'fail' };
  try { return { kind: 'ok', usage: mapPlanUsage(await res.json()) }; } catch { return { kind: 'fail' }; }
}

let refreshing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let cooldownUntil = 0;
let lastAttempt = 0;
let rateStreak = 0;

// Teto do castigo acumulado: mesmo apanhando em sequência, uma hora sem sequer
// tentar já é o suficiente — mais que isso a barra nunca voltaria sozinha.
export const RATE_PAD_MAX_MS = 30 * 60_000;
const RATE_PAD_STEP_MS = 5 * 60_000;

// Respeita o Retry-After da Anthropic e SOMA uma folga que cresce a cada 429
// seguido: voltar no segundo exato em que o bloqueio vence é o que renovava a
// punição sem parar (era o estado em que a barra vivia).
export function rateCooldownMs(waitMs: number, streak: number): number {
  return waitMs + Math.min(streak * RATE_PAD_STEP_MS, RATE_PAD_MAX_MS);
}

export function planUsageCooldownUntil() { return cooldownUntil; }

async function doFetch(): Promise<FetchOutcome['kind']> {
  const borrowed = borrowedSnapshot(readCacheEntry(), ownWriteTs, Date.now());
  if (borrowed) {
    last = borrowed;
    broadcast({ t: 'plan-usage', usage: borrowed });
    return 'ok';
  }
  const r = await fetchPlanUsage();
  if (r.kind === 'ok') {
    rateStreak = 0;
    last = r.usage;
    saveCache(r.usage);
    broadcast({ t: 'plan-usage', usage: r.usage });
  } else if (r.kind === 'rate') {
    rateStreak += 1;
    cooldownUntil = Date.now() + rateCooldownMs(r.waitMs, rateStreak);
  }
  return r.kind;
}

// Pede um snapshot AGORA (connect novo, ou poll). Single-flight: chamadas
// concorrentes coalescem. Em falha de rede agenda retries rápidos; em 429 NÃO
// retenta — respeita o Retry-After e fica fora do ar até lá (a barra segue no
// último valor conhecido, que é melhor que reabrir o bloqueio a cada 8s).
export function requestPlanUsageRefresh(attempt = 0): void {
  if (refreshing) return;
  const now = Date.now();
  if (now < cooldownUntil) return;
  if (attempt === 0 && now - lastAttempt < MIN_GAP_MS) return;
  lastAttempt = now;
  refreshing = true;
  void doFetch()
    .then((kind) => {
      refreshing = false;
      if (kind !== 'fail' || attempt >= RETRY_MAX || retryTimer) return;
      retryTimer = setTimeout(() => { retryTimer = null; requestPlanUsageRefresh(attempt + 1); }, RETRY_MS);
      retryTimer.unref?.();
    })
    .catch(() => { refreshing = false; });
}

export function startPlanUsageLoop(hasClients: () => boolean) {
  last ??= loadCache(); // barra pinta o último valor conhecido mesmo se o fetch estiver bloqueado
  requestPlanUsageRefresh(); // prime no boot pra a barra pintar no 1º connect
  setInterval(() => { if (hasClients()) requestPlanUsageRefresh(); }, POLL_MS).unref();
}
