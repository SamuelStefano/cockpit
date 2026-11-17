import type { Cron } from '../../../../shared/protocol';
import { MEETING_LIMITS, type MeetingInput } from '../../../../shared/team-meeting';

export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export type ScheduleResult = { ok: true; cron: Cron } | { ok: false; error: string };

// A daily cron whose server-side action starts the meeting: no LLM turn, participant ids only.
export function meetingCron(input: MeetingInput, hhmm: string, now: number): ScheduleResult {
  const atMinute = parseTime(hhmm);
  if (atMinute === null) return { ok: false, error: 'horário inválido' };
  if (input.question.length === 0 || input.question.length > MEETING_LIMITS.question) return { ok: false, error: 'pergunta inválida' };
  return {
    ok: true,
    cron: {
      id: `meeting-${now.toString(36)}`,
      name: `Reunião às ${hhmm}`,
      prompt: `Reunião: ${input.question.slice(0, 80)}`,
      action: { kind: 'team-meeting', ...input },
      schedule: { kind: 'daily', atMinute },
      enabled: true,
      createdAt: now,
    },
  };
}
