import type { Memory, TeamBot } from '../../../../shared/protocol';

const DAY = 86_400_000;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function whenLabel(ts: number, now: number): string {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (diff <= 0) return 'editada hoje';
  if (diff === 1) return 'ontem';
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function savedLabel(ts: number, now: number): string {
  const min = Math.floor((now - ts) / 60_000);
  if (min < 1) return 'salvo agora';
  if (min < 60) return `salvo há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `salvo há ${h} h`;
  return `salvo em ${whenLabel(ts, now)}`;
}

export function agentsLabel(n: number): string {
  if (n === 0) return 'nenhum agente';
  return n === 1 ? '1 agente' : `${n} agentes`;
}

export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function memorySubtitle(m: Memory, bots: TeamBot[], now: number): string {
  const bytes = new TextEncoder().encode(m.body).length;
  const author = bots.find((b) => b.id === m.updatedBy);
  const head = m.fileName ? `arquivo · ${sizeLabel(bytes)}` : author ? `atualizada pelo ${author.name}` : m.updatedBy === 'agent' ? 'atualizada pelo agente' : whenLabel(m.updatedAt, now);
  return `${head} · ${agentsLabel(m.agents.filter((id) => bots.some((b) => b.id === id)).length)}`;
}

export const MAX_FILE_BYTES = 200 * 1024;
export const TEXT_FILE_RE = /\.(md|markdown|txt|csv|tsv|json)$/i;

export function newMemoryId(): string {
  return `m-${Math.random().toString(16).slice(2, 12).padEnd(10, '0')}`;
}
