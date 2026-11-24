import type { Cron, TeamBot } from '../../../../shared/protocol';
import { CRON_TZ, midnightInTz, nextRunAt } from '../../../../shared/cron-schedule';
import { scheduleToText } from '../../../../shared/schedule-pt';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: CRON_TZ, hourCycle: 'h23', ...opts });
const clock = fmt({ hour: '2-digit', minute: '2-digit' });
const weekday = fmt({ weekday: 'short' });
const dayMonth = fmt({ day: 'numeric', month: 'short' });
const strip = (s: string) => s.replace('.', '').replace(' de ', ' ');

export const hhmm = (ts: number) => clock.format(ts);

export function dayLabel(ts: number, now: number): string {
  const diff = Math.round((midnightInTz(ts) - midnightInTz(now)) / DAY);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  if (diff < 0 && diff > -7) return strip(weekday.format(ts));
  return strip(dayMonth.format(ts));
}

export const stamp = (ts: number, now: number) => `${dayLabel(ts, now)} ${hhmm(ts)}`;

export function runLabel(ts: number): string {
  return `${strip(weekday.format(ts))}, ${strip(dayMonth.format(ts))} ${hhmm(ts)}`;
}

export function fmtUntil(target: number, now: number): string {
  const min = Math.round((target - now) / 60_000);
  if (min <= 0) return 'agora';
  if (min < 60) return `em ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `em ${h} h ${min % 60} min` : `em ${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `em ${d} d ${h % 24} h` : `em ${d} d`;
}

export function whenLabel(c: Cron): string {
  const t = scheduleToText(c.schedule);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const failed = (c: Cron) => !!c.lastFire && c.lastFire !== 'started';

const REASON: Record<string, string> = {
  'bot-busy': 'o agente estava ocupado',
  blocked: 'bloqueada até liberar a vaga',
  skipped: 'não conseguiu começar',
  'bot-gone': 'o agente foi removido',
};
export const failReason = (c: Cron) => REASON[c.lastFire ?? ''] ?? 'não conseguiu começar';

export interface RunState { tone: 'ok' | 'err' | 'muted'; text: string }

export function lastRunState(c: Cron, now: number): RunState {
  if (!c.lastRun) return { tone: 'muted', text: 'ainda não rodou' };
  const at = stamp(c.lastRun, now);
  return failed(c) ? { tone: 'err', text: `${at} · falhou` } : { tone: 'ok', text: `${at} · ok` };
}

export function botOf(c: Cron, bots: TeamBot[]): TeamBot | undefined {
  return c.botId ? bots.find((b) => b.id === c.botId) : undefined;
}

export function routineSub(c: Cron, bots: TeamBot[]): string {
  const name = c.botId ? (botOf(c, bots)?.name ?? 'Agente removido') : 'Sem agente';
  const what = c.prompt.replace(/\s+/g, ' ').trim();
  return `${name} · ${what}`;
}

export function nameFromPrompt(prompt: string): string {
  const one = prompt.replace(/\s+/g, ' ').trim();
  const sentence = one.split(/(?<=[.!?])\s/)[0] ?? one;
  const cut = sentence.length > 40 ? `${sentence.slice(0, 40).replace(/\s+\S*$/, '')}…` : sentence;
  return cut.replace(/[.!?]$/, '') || 'Rotina';
}

export interface SummaryCard { title: string; sub: string; tone?: 'err' }

export function nextCard(crons: Cron[], bots: TeamBot[], now: number): SummaryCard {
  const upcoming = crons
    .filter((c) => c.enabled && (c.schedule.kind !== 'once' || nextRunAt(c, now) > now))
    .map((c) => ({ c, at: nextRunAt(c, now) }))
    .sort((a, b) => a.at - b.at)[0];
  if (!upcoming) return { title: 'Nada agendado', sub: 'Nenhuma rotina ligada' };
  const { c, at } = upcoming;
  const when = dayLabel(at, now) === 'hoje' ? hhmm(at) : stamp(at, now);
  return { title: `Próxima: ${c.name} · ${when}`, sub: `${botOf(c, bots)?.name ?? 'Sem agente'} · ${fmtUntil(at, now)}` };
}

export function failureCard(crons: Cron[], now: number): SummaryCard {
  const bad = crons.filter((c) => c.enabled && failed(c));
  if (!bad.length) return { title: 'Nenhuma falha', sub: 'As últimas execuções saíram certas' };
  const first = bad.sort((a, b) => (b.lastRun ?? 0) - (a.lastRun ?? 0))[0];
  const again = first.retryAt ? `tenta de novo ${stamp(first.retryAt, now)}` : 'rode de novo quando quiser';
  const title = bad.length === 1 ? `1 falha ${first.lastRun ? dayLabel(first.lastRun, now) : ''}`.trim() : `${bad.length} falhas`;
  return { title, sub: `${first.name} · ${failReason(first)} · ${again}`, tone: 'err' };
}

export function weekCard(crons: Cron[], now: number): SummaryCard {
  const ran = crons.filter((c) => c.lastRun && c.lastRun > now - WEEK);
  const ok = ran.filter((c) => !failed(c)).length;
  const n = ran.length;
  return { title: 'Esta semana', sub: n === 0 ? 'Nenhuma execução ainda' : `${n} ${n === 1 ? 'rotina rodou' : 'rotinas rodaram'} · ${ok} ok` };
}

export interface HistoryItem { id: string; when: string; name: string; result: RunState; failed: boolean; botId?: string }

export function historyOf(crons: Cron[], now: number, limit = 20): HistoryItem[] {
  return crons
    .filter((c) => c.lastRun)
    .sort((a, b) => (b.lastRun ?? 0) - (a.lastRun ?? 0))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      when: stamp(c.lastRun as number, now),
      name: c.name,
      failed: failed(c),
      botId: c.botId,
      result: failed(c) ? { tone: 'err', text: `falhou · ${failReason(c)}` } : { tone: 'ok', text: 'ok' },
    }));
}

export function canToggleOn(c: Cron, now: number): boolean {
  return c.enabled || c.schedule.kind !== 'once' || (c.schedule.atMs ?? 0) > now;
}
