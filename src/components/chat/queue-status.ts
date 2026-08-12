import type { IconName } from '../primitives';

// Por que a fila não está enviando agora. Precedência: item segurado (falhou no teto
// de tentativas) > pausa manual > teto de tokens — o mais acionável primeiro.
export type QueueStatus = 'held' | 'paused' | 'quota' | 'open';

export function queueStatus(a: { held?: boolean; paused?: boolean; quotaHeld?: boolean }): QueueStatus {
  if (a.held) return 'held';
  if (a.paused) return 'paused';
  if (a.quotaHeld) return 'quota';
  return 'open';
}

export function queueStatusIcon(s: QueueStatus): IconName {
  return s === 'held' ? 'square' : s === 'paused' ? 'pause' : 'clock';
}

export function queueStatusLabel(s: QueueStatus, count: number, resetLabel?: string | null): string {
  if (s === 'held') return `fila parada (${count}) — o 1º item falhou 3x sem produzir nada; retome ou remova`;
  if (s === 'paused') return `fila pausada (${count}) — não vai enviar até retomar`;
  if (s === 'quota') return `fila aguardando tokens (${count}) — envia sozinha${resetLabel ? ` às ${resetLabel}` : ' quando resetar'}`;
  return count === 1 ? 'na fila' : `${count} na fila`;
}
