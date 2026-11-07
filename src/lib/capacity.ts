import type { CapacityInfo } from '../../shared/protocol';

export function capacityLabel(c: CapacityInfo): string {
  return `${c.live}/${c.cap}`;
}

export function capacityTip(name: string, c: CapacityInfo): string {
  const slots = `${name}: ${c.live} de ${c.cap} ${c.cap === 1 ? 'vaga' : 'vagas'}.`;
  return c.cap < c.configCap ? `${slots} Memória limita a ${c.cap}.` : `${slots} Limite configurado: ${c.configCap}.`;
}

// A chat that is already running replaces its own turn, so it never needs a new slot:
// only an idle chat meets a full box. Until the first frame arrives (or on an old
// server that never sends one) nothing is held back.
export function capacityBlocksSend(c: CapacityInfo | null, activeRunning: boolean): boolean {
  return !!c && !activeRunning && c.live >= c.cap;
}
