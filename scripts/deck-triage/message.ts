import { ACTIONS, type ActionId } from './actions.ts';
import { CHECK_LABELS, type Findings } from './checks.ts';
import { evidenceLines, type Diagnosis } from './diagnose.ts';
import type { Incident } from './incidents.ts';

export function incidentHead(inc: Incident): string {
  const who = inc.email ? inc.email : `conta ${inc.accountId.slice(0, 8)}`;
  return `Triagem ${inc.id}: ${inc.kind} (${inc.count} relatório(s), ${who})`;
}

// Failing and warning checks only, plus a count of the green ones. Relay log lines are
// shown only when asked for (/status); the Claude prompt always gets the full data.
export function formatTriage(head: string, d: Diagnosis, f: Findings, opts: { logs?: boolean } = {}): string {
  const lines = [head, '', `Causa provável (${d.source}): ${d.cause}`];
  if (d.owner) lines.push('', `Você precisa: ${d.owner}`);
  if (d.actions.length) lines.push('', `Correções disponíveis: ${d.actions.map((a) => ACTIONS[a].label).join(', ')}`);
  const shown = evidenceLines(f);
  const bad = shown.filter((l) => !l.startsWith('ok   '));
  lines.push('', 'Evidências:', ...bad);
  const green = shown.length - bad.length;
  if (green) lines.push(`+${green} verdes`);
  if (opts.logs && f.relayLog.length) lines.push('', 'Log do relay (últimas):', ...f.relayLog.slice(-5));
  return lines.join('\n');
}

export function formatRecheck(action: ActionId, result: string, f: Findings): string {
  const ids = new Set<string>(ACTIONS[action].recheck);
  const rel = f.checks.filter((c) => ids.has(c.id));
  const allOk = rel.length > 0 && rel.every((c) => c.status === 'ok');
  const verdict = allOk ? 'voltou' : 'ainda com falha';
  return [
    `${ACTIONS[action].label}: ${result}`,
    `Rechecagem: ${verdict}`,
    ...rel.map((c) => `${c.status === 'ok' ? 'ok   ' : 'FALHA'} ${CHECK_LABELS[c.id]}: ${c.detail}`),
  ].join('\n');
}

export function formatRecovery(downMs: number, wasFailing: string[]): string {
  return `Recuperado: checagens sintéticas verdes de novo depois de ${Math.max(1, Math.round(downMs / 60_000))} min (falhavam: ${wasFailing.join(', ')}).`;
}

export function formatAutoHeal(loginMs: number, action: ActionId, result: string, f: Findings): string {
  return [
    `Login travado há ${Math.max(1, Math.round(loginMs / 60_000))} min: executei ${ACTIONS[action].label} sozinho (limite de 1 por hora).`,
    formatRecheck(action, result, f),
  ].join('\n');
}

export function formatInvestigator(r: { ok: true; sessionId: string } | { ok: false; reason: string }): string {
  return r.ok
    ? `Abri uma sessão de investigação (Opus): ${r.sessionId}. Ela termina com causa e evidência; continue a conversa nela pelo Deck.`
    : `Não consegui abrir a sessão de investigação: ${r.reason}.`;
}

export const HELP_TEXT = [
  'deck-triage:',
  '/status roda as checagens agora.',
  '/metricas mostra disponibilidade, login e mensagens de 24 h e 7 d.',
  '/investigar [pedido] abre uma sessão Opus sua, com o contexto do bot e as últimas mensagens dele. Sem limite.',
  'Os botões só aparecem nas triagens e executam apenas ações da allowlist.',
].join('\n');
