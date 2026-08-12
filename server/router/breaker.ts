import type { FailureKind } from './classify';

// Circuit breaker por provedor, reduzido ao essencial do OmniRoute: um provedor que
// falhou fica em cooldown (OPEN) e é PULADO na seleção; quando o cooldown vence ele
// volta a ser elegível (equivale ao HALF_OPEN — a próxima chamada é a sonda, e o
// resultado dela abre de novo ou zera o contador).
//
// Puro de propósito: recebe `now` e devolve estado novo. Quem persiste é o state.ts.

export interface BreakerEntry {
  openUntil: number;   // epoch ms; 0 = fechado
  fails: number;       // falhas consecutivas (escala o backoff)
  lastKind: FailureKind;
  lastAt: number;
}

export type BreakerState = Record<string, BreakerEntry>;

// Cooldown base por tipo de falha. Um 500 volta em segundos; cota do dia não volta
// na mesma hora — retestar antes só queima o turno da fila de novo.
const BASE_MS: Record<Exclude<FailureKind, 'ok'>, number> = {
  transient: 30_000,
  rate_limit: 5 * 60_000,
  quota_exhausted: 60 * 60_000,
  auth: 6 * 60 * 60_000,
};

const MAX_MS: Record<Exclude<FailureKind, 'ok'>, number> = {
  transient: 5 * 60_000,
  rate_limit: 60 * 60_000,
  quota_exhausted: 24 * 60 * 60_000,
  auth: 24 * 60 * 60_000,
};

// Dica do provedor (parseResetHint) MANDA quando existe: ela sabe a hora real do
// reset, o backoff é só o chute de quem não sabe. Fora isso, backoff exponencial
// na falha consecutiva, com teto por tipo.
export function cooldownFor(kind: FailureKind, fails: number, resetHintMs?: number | null): number {
  if (kind === 'ok') return 0;
  if (resetHintMs && resetHintMs > 0) return Math.min(resetHintMs, MAX_MS[kind]);
  const base = BASE_MS[kind];
  const scaled = base * 2 ** Math.max(0, fails - 1);
  return Math.min(scaled, MAX_MS[kind]);
}

export function recordFailure(
  state: BreakerState,
  id: string,
  kind: FailureKind,
  now: number,
  resetHintMs?: number | null,
): BreakerState {
  if (kind === 'ok') return state;
  const prev = state[id];
  const fails = (prev?.fails ?? 0) + 1;
  const until = now + cooldownFor(kind, fails, resetHintMs);
  return {
    ...state,
    // Preserva o cooldown mais LONGO: uma falha transitória logo depois de uma cota
    // esgotada não pode encurtar a espera e liberar o provedor cedo demais.
    [id]: { openUntil: Math.max(until, prev?.openUntil ?? 0), fails, lastKind: kind, lastAt: now },
  };
}

export function recordSuccess(state: BreakerState, id: string): BreakerState {
  if (!state[id]) return state;
  const next = { ...state };
  delete next[id];
  return next;
}

export function isOpen(state: BreakerState, id: string, now: number): boolean {
  const e = state[id];
  return !!e && e.openUntil > now;
}

export function openUntil(state: BreakerState, id: string, now: number): number {
  const e = state[id];
  return e && e.openUntil > now ? e.openUntil : 0;
}

// Descarta entradas vencidas há tempo demais pra o arquivo de estado não crescer
// para sempre com provedor que já voltou.
export function prune(state: BreakerState, now: number, keepMs = 24 * 60 * 60_000): BreakerState {
  const next: BreakerState = {};
  for (const [id, e] of Object.entries(state)) {
    if (e.openUntil > now || now - e.lastAt < keepMs) next[id] = e;
  }
  return next;
}
