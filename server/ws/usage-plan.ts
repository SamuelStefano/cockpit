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
// ENQUANTO um turno roda o número muda a cada minuto, e o poll de 5min deixava a
// barra velha justamente na hora em que ela importa (era o "só atualiza com F5").
// O que derrubava o endpoint em 429 era pollar de minuto em minuto o DIA INTEIRO;
// aqui a cadência curta vale só nos minutos de turno vivo com browser aberto.
const ACTIVE_POLL_MS = 180_000;
// A Anthropic contabiliza o turno alguns segundos DEPOIS do processo fechar: um
// refresh só no instante do 'done' repinta o número de antes do turno.
const SETTLE_MS = 25_000;
// Falha transitória (rede/token sendo renovado) não pode deixar a barra em "—"
// por 60s até o próximo poll — retenta rápido algumas vezes antes de desistir.
const RETRY_MS = 8_000;
const RETRY_MAX = 3;
// 429 sem Retry-After legível: espera cega antes de tocar no endpoint de novo.
const COOLDOWN_FALLBACK_MS = 5 * 60_000;
// Floor between two network reads, SHARED by both polling processes through the
// cache file. `requestPlanUsageRefresh` fires on every connect, every panel open,
// every queue hold check and every turn end; the single-flight only merges
// SIMULTANEOUS calls, so a busy hour (crons + a phone reconnecting) still reached
// the endpoint dozens of times and it answered 429.
export const GAP_MIN_MS = 60_000;
// The endpoint's budget is unknown, so the gap adapts: every 429 doubles it, a
// run of clean reads halves it back. Blindness is spent on SPACING, not on
// punishment pads — a 60s Retry-After used to become 6, 11, 16 minutes of
// "the account refused", which is what made the panel useless.
export const GAP_MAX_MS = 15 * 60_000;
const GAP_RELAX_AFTER = 6;
// Small slack after Retry-After so we never land on the exact second the block ends.
export const RATE_JITTER_MS = 20_000;
// Sem timeout, um fetch pendurado deixa `refreshing` ligado PRA SEMPRE e toda
// chamada seguinte volta na primeira linha: a barra nunca mais carregaria, sem
// erro nenhum aparecendo. O abort transforma o pendurado numa falha normal, que
// os retries rápidos já sabem tratar.
const FETCH_TIMEOUT_MS = 15_000;
// Snapshot em disco: reiniciar o Deck no meio de um 429 longo (o Retry-After da
// Anthropic chega a ~40min) deixava a barra em "—" até o bloqueio passar, porque
// o último valor só existia na memória do processo morto.
const CACHE_PATH = process.env.COCKPIT_PLAN_USAGE ?? join(homedir(), '.cockpit', 'plan-usage.json');
// Precisa ser MAIOR que o bloqueio típico: com 30min o snapshot morria antes do
// Retry-After (visto em 3371s = 56min) e o restart caía num buraco — cache
// expirado de um lado, endpoint recusando do outro, barra cinza sem explicação.
// Número velho não engana: o painel carimba "última leitura" quando há bloqueio.
const CACHE_TTL_MS = 90 * 60_000;
// O arquivo também é o rendez-vous entre os DOIS processos que pollam (ws.ts e
// agent.ts): quem acha ali um snapshot fresco de OUTRO processo adota em vez de
// ir à rede. Sem isso eram dois pollers independentes gastando o mesmo orçamento
// e se derrubando por 429 — a barra ficava velha justamente por pedir demais.
const LEASE_MS = 4 * 60_000;

let last: PlanUsage | null = null;
export function getLastPlanUsage() { return last; }

// QUANDO o número em `last` foi lido da conta. A barra precisa disto pra não
// apresentar uma leitura de uma hora atrás como se fosse de agora: "0%" verde e
// confiante era pior que não mostrar nada.
let lastReadAt = 0;
export function getPlanUsageReadAt() { return lastReadAt; }

// `cooldownUntil`, `attemptTs` and `gapMs` live in the file, not only in memory:
// they are ACCOUNT state shared by the two processes that poll (ws.ts and
// agent.ts) and must survive a restart — a Deck restarted during a Retry-After
// used to hit the endpoint at boot and renew the block.
interface CacheEntry {
  ts: number;
  usage: PlanUsage;
  cooldownUntil?: number;
  attemptTs?: number;
  gapMs?: number;
  okStreak?: number;
}

// ts do último snapshot que ESTE processo escreveu: sem isso ele adotaria o
// próprio arquivo pra sempre e nunca mais buscaria nada.
let ownWriteTs = 0;

function writeCache(entry: CacheEntry): void {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    const tmp = `${CACHE_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(entry), 'utf8');
    renameSync(tmp, CACHE_PATH);
  } catch { /* cache é conforto, não pode derrubar o poll */ }
}

// Merge a partial state into the file: a 429 must not erase the last good number
// (the reading's age cannot be faked by an error) and a good read must not erase
// the learned gap.
function patchCache(patch: Partial<CacheEntry>): void {
  const prev = readCacheEntry();
  writeCache({ ts: prev?.ts ?? 0, usage: prev?.usage ?? last ?? ({} as PlanUsage), ...(prev ?? {}), ...patch });
}

function saveCache(usage: PlanUsage): void {
  ownWriteTs = Date.now();
  // A good read also clears the block on disk, or the sibling process would keep
  // honoring a cooldown from a window that has already turned.
  patchCache({ ts: ownWriteTs, usage, cooldownUntil: undefined, okStreak, gapMs });
}

// Account-level state written by this process in an earlier life, or by the sibling.
function persistedRate(): { until: number; attemptTs: number; gapMs: number; okStreak: number } {
  const e = readCacheEntry();
  const num = (v: unknown, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
  return { until: num(e?.cooldownUntil, 0), attemptTs: num(e?.attemptTs, 0), gapMs: num(e?.gapMs, GAP_MIN_MS), okStreak: num(e?.okStreak, 0) };
}

function readCacheEntry(): CacheEntry | null {
  try {
    const o = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    if (typeof o?.ts !== 'number') return null;
    return { ts: o.ts, usage: o.usage as PlanUsage, cooldownUntil: o.cooldownUntil, attemptTs: o.attemptTs, gapMs: o.gapMs, okStreak: o.okStreak };
  } catch { return null; }
}

function loadCache(): PlanUsage | null {
  const e = readCacheEntry();
  if (!e || !e.usage || Date.now() - e.ts > CACHE_TTL_MS) return null;
  lastReadAt = e.ts;
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

// AbortController explícito (e não AbortSignal.timeout) porque o timer daqui
// precisa ser o mesmo que o teste controla.
async function withTimeout(run: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try { return await run(ac.signal); } finally { clearTimeout(timer); }
}

export async function fetchPlanUsage(): Promise<FetchOutcome> {
  const token = await readOAuthToken();
  if (!token) return { kind: 'fail' };
  let res: Response;
  try {
    res = await withTimeout((signal) => fetch(USAGE_URL, {
      headers: { authorization: `Bearer ${token}`, 'anthropic-beta': OAUTH_BETA },
      signal,
    }));
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
let gapMs = GAP_MIN_MS;
let okStreak = 0;

// Next gap after a 429: double, capped.
export function widenGap(gap: number): number {
  return Math.min(GAP_MAX_MS, Math.max(GAP_MIN_MS, gap) * 2);
}

// Next gap after a clean read: halve once enough reads went through in a row.
export function relaxGap(gap: number, streak: number): { gapMs: number; okStreak: number } {
  if (streak < GAP_RELAX_AFTER) return { gapMs: gap, okStreak: streak };
  return { gapMs: Math.max(GAP_MIN_MS, Math.floor(gap / 2)), okStreak: 0 };
}

export function planUsageCooldownUntil() { return cooldownUntil; }
export function planUsageGapMs() { return gapMs; }

// Pull the shared state from disk into memory (restart, or the sibling learned
// something first). Memory only ever moves towards the stricter value.
function syncFromDisk(): void {
  const disk = persistedRate();
  if (disk.until > cooldownUntil) cooldownUntil = disk.until;
  if (disk.attemptTs > lastAttempt) lastAttempt = disk.attemptTs;
  if (disk.gapMs > gapMs) { gapMs = disk.gapMs; okStreak = disk.okStreak; }
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Bloqueio ATIVO (0 quando já venceu). O cliente precisa disto pra distinguir
// "ainda não li" de "a conta recusou e eu só tento de novo às tantas".
export function planUsageBlockedUntil(now = Date.now()): number {
  // Também olha o disco: logo após um restart a memória ainda não sabe do bloqueio
  // e o painel diria "lendo da conta…" durante a hora inteira de castigo.
  const until = Math.max(cooldownUntil, persistedRate().until);
  return until > now ? until : 0;
}

export interface PlanUsageFrame { t: 'plan-usage'; usage: PlanUsage | null; blockedUntil: number | null; readAt: number | null }

// One frame for the broadcast, the listen bootstrap and the relay re-bootstrap. The
// relay path used to send `usage` alone: every browser that (re)connected through it
// had its 429 block and reading age reset to null — a stale number shown as fresh —
// and got nothing at all when the agent had no number yet during a cooldown.
export function planUsageFrame(now = Date.now()): PlanUsageFrame | null {
  const blockedUntil = planUsageBlockedUntil(now);
  if (!last && !blockedUntil) return null;
  return { t: 'plan-usage', usage: last, blockedUntil: blockedUntil || null, readAt: lastReadAt || null };
}

function emit(): void {
  const frame = planUsageFrame();
  if (frame) broadcast(frame);
}

let lastAdoptedTs = 0;

// A fresh snapshot from the sibling process means this round needs no network at
// all — every time, not only the first time we see it. Returning false once it had
// been adopted sent the second process to the endpoint anyway, so the lease only
// saved one request per sibling write and both pollers kept spending the budget.
function adoptShared(now: number): boolean {
  const entry = readCacheEntry();
  const usage = borrowedSnapshot(entry, ownWriteTs, now);
  if (!entry || !usage) return false;
  if (entry.ts !== lastAdoptedTs) {
    lastAdoptedTs = entry.ts;
    last = usage;
    lastReadAt = entry.ts;
    emit();
  }
  return true;
}

async function doFetch(): Promise<FetchOutcome['kind']> {
  const r = await fetchPlanUsage();
  if (r.kind === 'ok') {
    ({ gapMs, okStreak } = relaxGap(gapMs, okStreak + 1));
    last = r.usage;
    lastReadAt = Date.now();
    saveCache(r.usage);
    console.log(`[usage] 200 5h=${r.usage.fiveHour}% 7d=${r.usage.sevenDay}% gap=${Math.round(gapMs / 1000)}s`);
    emit();
  } else if (r.kind === 'rate') {
    gapMs = widenGap(gapMs);
    okStreak = 0;
    cooldownUntil = Date.now() + r.waitMs + RATE_JITTER_MS;
    patchCache({ cooldownUntil, gapMs, okStreak });
    console.log(`[usage] 429 retry-after=${Math.round(r.waitMs / 1000)}s → next try ${hhmm(cooldownUntil)}, gap=${Math.round(gapMs / 1000)}s`);
    // Announce the block: without this the bar sat at "—" looking like it was loading.
    emit();
  } else {
    console.log('[usage] read failed (network/token)');
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
  // O lease do irmão é checado ANTES do cooldown: o castigo do 429 é deste
  // processo, não do dado. Ficar 40min cego com um snapshot fresco no disco ao
  // lado é exatamente o estado que este arquivo existe pra evitar.
  if (adoptShared(now)) return;
  // Disk state beats memory: the process forgets on restart, and the sibling may
  // have just been told to back off.
  syncFromDisk();
  if (now < cooldownUntil) return;
  if (attempt === 0 && now - lastAttempt < gapMs) return;
  lastAttempt = now;
  if (attempt === 0) patchCache({ attemptTs: now });
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

let settleTimer: ReturnType<typeof setTimeout> | null = null;

// O uso ACABOU de mudar (turno fechou). UMA ida só, depois do settle: buscar no
// instante do 'done' volta com o número de antes do turno (a conta contabiliza
// com atraso), então seriam dois requests pra um número útil. O orçamento do
// endpoint é curto — ele responde 429 com Retry-After de quase uma hora.
export function notePlanUsageChanged(): void {
  if (settleTimer) return;
  settleTimer = setTimeout(() => { settleTimer = null; requestPlanUsageRefresh(); }, SETTLE_MS);
  settleTimer.unref?.();
}

export function startPlanUsageLoop(hasClients: () => boolean, hasActiveRun: () => boolean = () => false) {
  last ??= loadCache(); // barra pinta o último valor conhecido mesmo se o fetch estiver bloqueado
  syncFromDisk();
  requestPlanUsageRefresh(); // prime no boot pra a barra pintar no 1º connect
  // Um tick só, na cadência curta: com turno vivo ele busca sempre; ocioso, deixa
  // passar até fechar os 5min. Dois setInterval separados se sobreporiam e o
  // ocioso dobraria o gasto durante o turno.
  let lastIdlePoll = Date.now();
  setInterval(() => {
    if (!hasClients()) return;
    const now = Date.now();
    if (!hasActiveRun() && now - lastIdlePoll < POLL_MS) return;
    lastIdlePoll = now;
    requestPlanUsageRefresh();
  }, ACTIVE_POLL_MS).unref();
}
