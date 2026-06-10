import type { PlanUsage } from '../../shared/protocol';
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
  const n = typeof v === 'number' ? v : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseReset(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export function mapPlanUsage(body: unknown): PlanUsage {
  const b = body as { five_hour?: { utilization?: number; resets_at?: string }; seven_day?: { utilization?: number } };
  return {
    fiveHour: pct(b?.five_hour?.utilization),
    sevenDay: pct(b?.seven_day?.utilization),
    resetsAt: parseReset(b?.five_hour?.resets_at),
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
