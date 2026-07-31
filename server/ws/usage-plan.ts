import type { PlanUsage, PlanWindowKey } from '../../shared/protocol';
import { broadcast } from './broadcast';
import { readOAuthToken, OAUTH_BETA } from '../oauth';

// Uso GLOBAL do plano (claude.ai/settings/usage). Lê o token OAuth do CLI
// (~/.claude/.credentials.json) e consulta o endpoint de usage da Anthropic.
// SEGURANÇA: o token NUNCA sai do servidor — só os números de utilização vão
// pro cliente. O arquivo é relido a cada poll pra pegar o token já renovado
// pelo CLI (que faz o refresh sozinho).
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const POLL_MS = 60_000;
// Falha transitória (rede/token sendo renovado) não pode deixar a barra em "—"
// por 60s até o próximo poll — retenta rápido algumas vezes antes de desistir.
const RETRY_MS = 8_000;
const RETRY_MAX = 3;

let last: PlanUsage | null = null;
export function getLastPlanUsage() { return last; }

function pct(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseReset(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

// Ordem canônica em que as janelas aparecem na UI — do escopo mais curto ao mais
// longo, com o excedente pago por último.
const WINDOW_KEYS: PlanWindowKey[] = ['five_hour', 'seven_day', 'seven_day_opus', 'seven_day_sonnet', 'overage'];

type RawWindow = { utilization?: number; resets_at?: string };

export function mapPlanUsage(body: unknown): PlanUsage {
  const b = (body ?? {}) as Partial<Record<PlanWindowKey, RawWindow>>;
  // `utilization` finito é o que separa "a conta tem esse limite" de "esse limite
  // não existe no plano" — sem o filtro, toda janela viraria 0%.
  const windows = WINDOW_KEYS.filter((k) => Number.isFinite(b?.[k]?.utilization)).map((key) => ({
    key,
    pct: pct(b[key]?.utilization),
    resetsAt: parseReset(b[key]?.resets_at),
  }));
  // Os campos avulsos saem do MESMO array que o popover lê: header e detalhe não
  // podem discordar sobre a mesma janela.
  const find = (k: PlanWindowKey) => windows.find((w) => w.key === k);
  return {
    fiveHour: find('five_hour')?.pct ?? 0,
    sevenDay: find('seven_day')?.pct ?? 0,
    resetsAt: find('five_hour')?.resetsAt ?? null,
    windows,
  };
}

export async function fetchPlanUsage(): Promise<PlanUsage | null> {
  const token = await readOAuthToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(USAGE_URL, {
      headers: { authorization: `Bearer ${token}`, 'anthropic-beta': OAUTH_BETA },
    });
  } catch { return null; }
  if (!res.ok) return null;
  try { return mapPlanUsage(await res.json()); } catch { return null; }
}

let refreshing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

async function doFetch(): Promise<boolean> {
  const u = await fetchPlanUsage();
  if (!u) return false;
  last = u;
  broadcast({ t: 'plan-usage', usage: u });
  return true;
}

// Pede um snapshot AGORA (connect novo, ou poll). Single-flight: chamadas
// concorrentes coalescem. Em falha, agenda retries rápidos antes do próximo poll.
export function requestPlanUsageRefresh(attempt = 0): void {
  if (refreshing) return;
  refreshing = true;
  void doFetch()
    .then((ok) => {
      refreshing = false;
      if (ok || attempt >= RETRY_MAX || retryTimer) return;
      retryTimer = setTimeout(() => { retryTimer = null; requestPlanUsageRefresh(attempt + 1); }, RETRY_MS);
      retryTimer.unref?.();
    })
    .catch(() => { refreshing = false; });
}

export function startPlanUsageLoop(hasClients: () => boolean) {
  requestPlanUsageRefresh(); // prime no boot pra a barra pintar no 1º connect
  setInterval(() => { if (hasClients()) requestPlanUsageRefresh(); }, POLL_MS).unref();
}
