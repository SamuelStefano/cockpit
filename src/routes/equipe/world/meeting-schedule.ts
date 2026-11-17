import type { Cron } from '../../../../shared/protocol';
import { MEETING_LIMITS, type MeetingInput } from '../../../../shared/team-meeting';

export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

// Stable id per (participants, moderator, time): scheduling the same meeting twice upserts one cron.
export function meetingCronId(input: Pick<MeetingInput, 'participantIds' | 'moderatorId'>, hhmm: string): string {
  const raw = `${[...input.participantIds].sort().join(',')}|${input.moderatorId}|${hhmm}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 0x01000193) >>> 0;
  return `meeting-${h.toString(36)}`;
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
      id: meetingCronId(input, hhmm),
      name: `Reunião às ${hhmm}`,
      prompt: `Reunião: ${input.question.slice(0, 80)}`,
      action: { kind: 'team-meeting', ...input },
      schedule: { kind: 'daily', atMinute },
      enabled: true,
      createdAt: now,
    },
  };
}
