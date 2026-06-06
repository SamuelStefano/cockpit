import type { WebSocketServer } from 'ws';
import { collect } from '../stats';
import { broadcast } from './broadcast';
import { markStatsAt } from './runs';

// Um timer único: amostra a máquina e empurra pra todos os clientes abertos.
// 2s é suave e mantém o delta de CPU significativo.
// Watchdog (#103): marca saturação quando CPU/RAM ficam acima do teto por uma
// janela contínua. APENAS alerta — não mata processo (a sessão real do usuário
// não pode ser derrubada). Streak zera assim que o recurso esfria.
const SAT_PCT = 92;
const SAT_WINDOW_MS = 40_000;

export function startStatsLoop(wss: WebSocketServer) {
  let cpuHotSince = 0;
  let memHotSince = 0;
  const tick = async () => {
    if (wss.clients.size === 0) return;
    try {
      const stats = await collect();
      const now = Date.now();
      const memPct = stats.mem.total ? (stats.mem.used / stats.mem.total) * 100 : 0;
      cpuHotSince = stats.cpu >= SAT_PCT ? (cpuHotSince || now) : 0;
      memHotSince = memPct >= SAT_PCT ? (memHotSince || now) : 0;
      const cpuSat = cpuHotSince > 0 && now - cpuHotSince >= SAT_WINDOW_MS;
      const memSat = memHotSince > 0 && now - memHotSince >= SAT_WINDOW_MS;
      if (cpuSat || memSat) {
        const since = Math.min(cpuSat ? cpuHotSince : Infinity, memSat ? memHotSince : Infinity);
        stats.saturated = { cpu: cpuSat, mem: memSat, seconds: Math.round((now - since) / 1000) };
      }
      broadcast({ t: 'stats', stats });
      markStatsAt(now);
    } catch { /* best-effort */ }
  };
  setInterval(tick, 2000).unref();
}
