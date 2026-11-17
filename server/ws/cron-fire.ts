import type { Cron, CronAction } from '../../shared/protocol';
import type { Role } from '../auth';
import { validateMeetingInput } from '../../shared/team-meeting';
import { startMeeting, type MeetingDeps } from '../team-meetings';
import { liveMeetingDeps } from './team-meeting-frames';
import { fireCron, type CronFire } from './runs';

export type CronFireResult = CronFire | { outcome: 'failed'; error: string };

export async function fireMeetingAction(cron: Cron, deps: MeetingDeps = liveMeetingDeps()): Promise<CronFireResult> {
  const a = cron.action;
  if (!a) return 'skipped';
  const r = await startMeeting({ question: a.question, participantIds: a.participantIds, moderatorId: a.moderatorId }, deps);
  if (r.ok) return 'started';
  console.error(`[cron ${cron.id}] meeting failed: ${r.error}`);
  return { outcome: 'failed', error: r.error };
}

export function fireAnyCron(cron: Cron): Promise<CronFireResult> {
  return cron.action ? fireMeetingAction(cron) : fireCron(cron);
}

export type CronActionValidation = { ok: true; action: CronAction } | { ok: false; error: string };

export function validateCronAction(raw: unknown, role: Role | undefined, team: { id: string; name: string; model?: string }[]): CronActionValidation {
  if (role !== 'admin') return { ok: false, error: 'só o admin agenda reunião' };
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.kind !== 'team-meeting') return { ok: false, error: 'ação inválida' };
  const v = validateMeetingInput(r, team);
  if (!v.ok) return v;
  return { ok: true, action: { kind: 'team-meeting', ...v.input } };
}
