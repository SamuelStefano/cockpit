import type { IconName } from '../primitives';

// Por que a fila não está enviando agora. Precedência: item segurado (falhou no teto
// de tentativas) > pausa manual > teto de tokens > cooldown pós-reset — o mais
// acionável primeiro.
export type QueueStatus = 'held' | 'paused' | 'quota' | 'releasing' | 'open';

export function queueStatus(a: { held?: boolean; paused?: boolean; quotaHeld?: boolean; releaseAt?: number; now?: number }): QueueStatus {
  if (a.held) return 'held';
  if (a.paused) return 'paused';
  if (a.quotaHeld) return 'quota';
  if ((a.releaseAt ?? 0) > (a.now ?? Date.now())) return 'releasing';
  return 'open';
}

export function queueStatusIcon(s: QueueStatus): IconName {
  return s === 'held' ? 'square' : s === 'paused' ? 'pause' : 'clock';
}

export function queueStatusLabel(s: QueueStatus, count: number, resetLabel?: string | null, releaseAt = 0, now = Date.now()): string {
  if (s === 'held') return `fila parada (${count}) — o 1º item falhou 3x sem produzir nada; retome ou remova`;
  if (s === 'paused') return `fila pausada (${count}) — não vai enviar até retomar`;
  if (s === 'quota') return `fila aguardando tokens (${count}) — envia sozinha${resetLabel ? ` às ${resetLabel}` : ' quando resetar'}`;
  if (s === 'releasing') return `fila soltando (${count}) — 1º envio em ${Math.max(1, Math.ceil((releaseAt - now) / 1000))}s, depois 1 a cada 30s`;
  return count === 1 ? 'na fila' : `${count} na fila`;
}
