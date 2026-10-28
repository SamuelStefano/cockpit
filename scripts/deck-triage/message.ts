import { ACTIONS, type ActionId } from './actions.ts';
import { CHECK_LABELS, type Findings } from './checks.ts';
import { evidenceLines, type Diagnosis } from './diagnose.ts';
import type { Incident } from './incidents.ts';

export function formatTriage(inc: Incident | null, d: Diagnosis, f: Findings): string {
  const head = inc
    ? `Triagem ${inc.id}: ${inc.kind} (${inc.reports.length} relatório(s), conta ${inc.accountId.slice(0, 8)})`
    : 'Status sob demanda';
  const lines = [head, '', `Causa provável (${d.source}): ${d.cause}`];
  if (d.owner) lines.push('', `Você precisa: ${d.owner}`);
  if (d.actions.length) lines.push('', `Correções disponíveis: ${d.actions.map((a) => ACTIONS[a].label).join(', ')}`);
  lines.push('', 'Evidências:', ...evidenceLines(f));
  if (f.relayLog.length) lines.push('', 'Log do relay (últimas):', ...f.relayLog.slice(-5));
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

export const HELP_TEXT = 'deck-triage: /status roda as checagens agora. Os botões só aparecem nas triagens e executam apenas ações da allowlist.';
