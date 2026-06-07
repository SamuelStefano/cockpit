import type { Session } from '../data/mock';

// Sinais derivados do sidebar, puros e testáveis (extraídos do useCockpit).

// Sessão viva (em `running`) mas sem nenhum frame há mais que o limiar = "quieta":
// tool longo, rate-limit ou travada. Não é alarme — só um sinal de relance.
export const STALL_MS = 120_000;

export function computeStalled(
  running: Iterable<string>,
  lastActivity: Record<string, number>,
  now: number,
  stallMs = STALL_MS,
): Set<string> {
  return new Set([...running].filter((k) => now - (lastActivity[k] ?? now) > stallMs));
}

// Sessão NÃO-ativa, sem run vivo, já vista uma vez (baseline em `seen`) e cujo
// mtime no servidor avançou além do visto = produziu output novo desde a visita.
export function computeUpdated(
  sessions: Session[],
  seen: Record<string, number>,
  activeId: string,
  running: Set<string>,
): Set<string> {
  return new Set(
    sessions
      .filter((s) => s.id !== activeId && !running.has(s.id) && seen[s.id] !== undefined && s.mtime > seen[s.id])
      .map((s) => s.id),
  );
}
