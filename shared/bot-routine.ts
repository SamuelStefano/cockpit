import type { Cron, TeamBot } from './protocol';

// A bot routine resumes the bot's whole thread on every fire, so a tighter interval
// re-reads that context every few minutes — the study's floor (Grok) is 5 min too.
export const MIN_BOT_ROUTINE_MINUTES = 5;

const ID_RE = /^[a-z0-9]{4,24}$/;

export function botRoutineError(cron: Pick<Cron, 'botId' | 'schedule'>, bots: Pick<TeamBot, 'id'>[]): string | null {
  if (cron.botId === undefined) return null;
  if (typeof cron.botId !== 'string' || !ID_RE.test(cron.botId)) return 'bot inválido';
  if (!bots.some((b) => b.id === cron.botId)) return 'bot não encontrado';
  if (cron.schedule.kind === 'interval' && (cron.schedule.everyMinutes ?? 0) < MIN_BOT_ROUTINE_MINUTES) {
    return `rotina de bot roda no mínimo a cada ${MIN_BOT_ROUTINE_MINUTES} min`;
  }
  return null;
}

export function routinesOf(crons: Cron[], botId: string): Cron[] {
  return crons.filter((c) => c.botId === botId);
}
