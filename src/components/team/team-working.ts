import type { BotView } from '../../routes/equipe/team-view';

export const LEAVE_LINGER_MS = 1_500;
export const LEAVE_FADE_MS = 200;

const ACTIVE = new Set(['thinking', 'working', 'waiting']);

export const isWorkingState = (s: string) => ACTIVE.has(s);

// The card lists the capo's team (everyone but the capo itself) and is due while
// at least one of them is mid-turn.
export function teamRows(views: BotView[], capoId: string): BotView[] {
  return views.filter((v) => v.bot.id !== capoId);
}

export function teamIsWorking(rows: BotView[]): boolean {
  return rows.some((v) => isWorkingState(v.state));
}

export function earliestStart(rows: BotView[]): number | undefined {
  const starts = rows.filter((v) => isWorkingState(v.state) && v.startedAt !== undefined).map((v) => v.startedAt as number);
  return starts.length ? Math.min(...starts) : undefined;
}

export function agoLabel(from: number, now: number): string {
  const min = Math.max(0, Math.floor((now - from) / 60_000));
  if (min < 1) return 'agora';
  return min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)} h`;
}

export function clockLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

export function rowStatus(v: BotView): { phrase?: string; faint: boolean } {
  switch (v.state) {
    case 'waiting': return { phrase: 'Esperando você', faint: false };
    case 'error': return { phrase: 'Travou', faint: false };
    case 'done': return { phrase: 'Concluiu', faint: false };
    case 'idle': return { phrase: 'Livre', faint: true };
    default: return { faint: false };
  }
}
