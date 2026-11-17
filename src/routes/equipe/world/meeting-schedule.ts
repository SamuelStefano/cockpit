import type { Cron } from '../../../../shared/protocol';
import { MEETING_LIMITS, type MeetingInput } from '../../../../shared/team-meeting';

const sh = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

// The same command a human types: `deckctl meeting start` sends the `team-meeting-start`
// frame, so a scheduled meeting goes through the exact backend path "Convocar" uses.
export function meetingCommand(input: MeetingInput, names: Record<string, string>): string {
  const name = (id: string) => (names[id] ?? id).replace(/,/g, ' ');
  return `deckctl meeting start --q ${sh(input.question)} --with ${sh(input.participantIds.map(name).join(','))} --moderator ${sh(name(input.moderatorId))}`;
}

export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export type ScheduleResult = { ok: true; cron: Cron } | { ok: false; error: string };

// A daily cron (existing crons system) whose prompt runs the meeting command.
export function meetingCron(input: MeetingInput, names: Record<string, string>, hhmm: string, now: number): ScheduleResult {
  const atMinute = parseTime(hhmm);
  if (atMinute === null) return { ok: false, error: 'horário inválido' };
  if (input.question.length === 0 || input.question.length > MEETING_LIMITS.question) return { ok: false, error: 'pergunta inválida' };
  return {
    ok: true,
    cron: {
      id: `meeting-${now.toString(36)}`,
      name: `Reunião às ${hhmm}`,
      prompt: `Run exactly this shell command, nothing else, then reply "done": ${meetingCommand(input, names)}`,
      schedule: { kind: 'daily', atMinute },
      mode: 'auto',
      enabled: true,
      createdAt: now,
    },
  };
}
