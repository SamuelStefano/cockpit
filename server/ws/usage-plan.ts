import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { WebSocketServer } from 'ws';
import type { PlanUsage } from '../../shared/protocol';
import { broadcast } from './broadcast';

// Uso GLOBAL do plano (claude.ai/settings/usage). Lê o token OAuth do CLI
// (~/.claude/.credentials.json) e consulta o endpoint de usage da Anthropic.
// SEGURANÇA: o token NUNCA sai do servidor — só os números de utilização vão
// pro cliente. O arquivo é relido a cada poll pra pegar o token já renovado
// pelo CLI (que faz o refresh sozinho).
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const OAUTH_BETA = 'oauth-2025-04-20';
const POLL_MS = 60_000;

let last: PlanUsage | null = null;
export function getLastPlanUsage() { return last; }

async function readToken(): Promise<string | null> {
  try {
    const raw = await readFile(join(homedir(), '.claude', '.credentials.json'), 'utf8');
    const tok = JSON.parse(raw)?.claudeAiOauth?.accessToken;
    return typeof tok === 'string' && tok ? tok : null;
  } catch { return null; }
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

export function mapPlanUsage(body: unknown): PlanUsage {
  const b = body as { five_hour?: { utilization?: number; resets_at?: string }; seven_day?: { utilization?: number } };
  return {
    fiveHour: pct(b?.five_hour?.utilization),
    sevenDay: pct(b?.seven_day?.utilization),
    resetsAt: parseReset(b?.five_hour?.resets_at),
  };
}

export async function fetchPlanUsage(): Promise<PlanUsage | null> {
  const token = await readToken();
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

export function startPlanUsageLoop(wss: WebSocketServer) {
  const tick = async (force = false) => {
    // Prime uma vez no boot (force) pra a barra pintar no primeiro connect; depois
    // só poll quando há cliente, pra não bater no endpoint à toa.
    if (!force && wss.clients.size === 0) return;
    const u = await fetchPlanUsage();
    if (!u) return;
    last = u;
    broadcast({ t: 'plan-usage', usage: u });
  };
  tick(true);
  setInterval(() => tick(), POLL_MS).unref();
}
