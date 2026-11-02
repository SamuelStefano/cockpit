import { CHECK_LABELS, type CheckId } from './checks.ts';
import type { Runner } from './exec.ts';

const MIN = 60_000;

export const LOGIN_IDS: readonly CheckId[] = ['login_path', 'auth_flow'];
export const HEAL_AFTER_MS = 5 * MIN;
export const HEAL_COOLDOWN_MS = 60 * MIN;
export const INVESTIGATE_AFTER_HEAL_MS = 5 * MIN;
export const INVESTIGATE_OUTAGE_MS = 15 * MIN;
export const INVESTIGATE_COOLDOWN_MS = 6 * 60 * MIN;
export const DECKCTL_TIMEOUT_MS = 30_000;
export const INVESTIGATOR_MODEL = 'claude-opus-5-5';
export const INVESTIGATOR_TITLE = 'Deck fora: investigar';

// A restart cannot fix these: the relay host is unreachable or name resolution is broken.
const NOT_HEALABLE: readonly CheckId[] = ['ssh', 'dns_cf', 'dns_google'];

export const loginFailing = (ids: readonly string[]): boolean => LOGIN_IDS.some((id) => ids.includes(id));

export function trackLoginFailing(since: number | null, failingIds: readonly string[], now: number): number | null {
  if (!loginFailing(failingIds)) return null;
  return since ?? now;
}

export interface ResponderInput {
  now: number;
  failingIds: readonly string[];
  loginFailingSince: number | null;
  outage: { down: boolean; since: number };
  lastHealAt: number | null;
  lastInvestigateAt: number | null;
}
export type ResponderDecision = 'heal' | 'investigate' | null;

export const investigatorAllowed = (now: number, last: number | null): boolean => last === null || now - last >= INVESTIGATE_COOLDOWN_MS;

export function decideResponder(i: ResponderInput): ResponderDecision {
  const healable = !NOT_HEALABLE.some((id) => i.failingIds.includes(id));
  if (healable && i.loginFailingSince !== null && i.now - i.loginFailingSince >= HEAL_AFTER_MS && (i.lastHealAt === null || i.now - i.lastHealAt >= HEAL_COOLDOWN_MS)) return 'heal';
  if (!i.outage.down || !investigatorAllowed(i.now, i.lastInvestigateAt)) return null;
  const afterHeal = i.lastHealAt !== null && i.lastHealAt >= i.outage.since && i.now - i.lastHealAt >= INVESTIGATE_AFTER_HEAL_MS;
  if (afterHeal || i.now - i.outage.since >= INVESTIGATE_OUTAGE_MS) return 'investigate';
  return null;
}

// Fixed text plus check ids from the CheckId allowlist. Never a detail, report or log line.
export function buildInvestigatorPrompt(failingIds: readonly string[]): string {
  const known = new Set<string>(Object.keys(CHECK_LABELS));
  const ids = [...new Set(failingIds.filter((id) => known.has(id)))];
  return [
    'O Deck (relay, login do navegador) está fora ou degradado e a correção automática não resolveu. Investigue.',
    `Checagens falhando agora: ${ids.length ? ids.join(', ') : '(nenhuma no momento; confirme o estado atual)'}.`,
    'Use a skill deck-ops. Diagnostique a causa raiz com evidência (journalctl do deck-relay e do caddy, /status, teste de login).',
    'Você pode reiniciar deck-relay e caddy se isso ajudar. Não toque em mais nada: sem deploy, sem edição de código, sem banco, sem outros serviços.',
    'Termine com uma mensagem curta: causa e evidência.',
  ].join('\n');
}

// `deckctl new` prints the full session id alone on stdout.
export function parseSessionId(stdout: string): string | null {
  const line = stdout.trim().split('\n').pop()?.trim() ?? '';
  return /^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/.test(line) ? line : null;
}

export type InvestigatorResult = { ok: true; sessionId: string } | { ok: false; reason: string };

export async function launchInvestigator(deps: { runner: Runner; bin: string; home: string }, failingIds: readonly string[]): Promise<InvestigatorResult> {
  try {
    const r = await deps.runner(deps.bin, ['new', buildInvestigatorPrompt(failingIds), '--cwd', deps.home, '--title', INVESTIGATOR_TITLE, '--model', INVESTIGATOR_MODEL], { timeoutMs: DECKCTL_TIMEOUT_MS });
    if (r.timedOut) return { ok: false, reason: `deckctl não respondeu em ${DECKCTL_TIMEOUT_MS / 1000}s` };
    if (r.code === 3) return { ok: false, reason: 'o Deck aceitou mas enfileirou a sessão (cota); ela começa quando a fila andar' };
    const id = parseSessionId(r.stdout);
    if (r.code !== 0 || !id) return { ok: false, reason: `deckctl saiu com ${r.code ?? 'erro'}${r.stderr ? `: ${r.stderr.trim().slice(0, 120)}` : ''}` };
    return { ok: true, sessionId: id };
  } catch (e) {
    return { ok: false, reason: (e as Error).message.slice(0, 120) };
  }
}
