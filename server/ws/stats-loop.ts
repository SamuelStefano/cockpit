import type { WebSocketServer } from 'ws';
import { collect } from '../stats';
import { broadcast } from './broadcast';
import { markStatsAt } from './runs';

// Um timer único: amostra a máquina e empurra pra todos os clientes abertos.
// 2s é suave e mantém o delta de CPU significativo.
// Watchdog (#103): marca saturação quando CPU/RAM ficam acima do teto por uma
// janela contínua. APENAS alerta — não mata processo (a sessão real do usuário
// não pode ser derrubada). Streak zera assim que o recurso esfria.
export const SAT_PCT = 92;
export const SAT_WINDOW_MS = 40_000;

export interface SatState {
  cpuHotSince: number;
  memHotSince: number;
}

export interface Saturated {
  cpu: boolean;
  mem: boolean;
  seconds: number;
}

export function evalSaturation(
  prev: SatState,
  cpuPct: number,
  memPct: number,
  now: number,
): { state: SatState; saturated?: Saturated } {
  const cpuHotSince = cpuPct >= SAT_PCT ? prev.cpuHotSince || now : 0;
  const memHotSince = memPct >= SAT_PCT ? prev.memHotSince || now : 0;
  const state = { cpuHotSince, memHotSince };
  const cpuSat = cpuHotSince > 0 && now - cpuHotSince >= SAT_WINDOW_MS;
  const memSat = memHotSince > 0 && now - memHotSince >= SAT_WINDOW_MS;
  if (!cpuSat && !memSat) return { state };
  const since = Math.min(cpuSat ? cpuHotSince : Infinity, memSat ? memHotSince : Infinity);
  return { state, saturated: { cpu: cpuSat, mem: memSat, seconds: Math.round((now - since) / 1000) } };
}

export function startStatsLoop(wss: WebSocketServer) {
  let sat: SatState = { cpuHotSince: 0, memHotSince: 0 };
  const tick = async () => {
    if (wss.clients.size === 0) return;
    try {
      const stats = await collect();
      const now = Date.now();
      const memPct = stats.mem.total ? (stats.mem.used / stats.mem.total) * 100 : 0;
      const r = evalSaturation(sat, stats.cpu, memPct, now);
      sat = r.state;
      if (r.saturated) stats.saturated = r.saturated;
      broadcast({ t: 'stats', stats });
      markStatsAt(now);
    } catch { /* best-effort */ }
  };
  setInterval(tick, 2000).unref();
}
