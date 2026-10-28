import type { Cron, TeamBotInput } from '../../shared/protocol';
import type { Role } from '../auth';
import { isAgentModel } from '../../shared/agents';

// A bot saved by anyone but admin is always locked: restricted, no ACP agent, and
// no mode other than auto. Coerced instead of refused so the student's form never
// fails on a field the UI does not even show them.
export function coerceBotForRole(bot: TeamBotInput, role: Role | undefined): TeamBotInput {
  if (role === 'admin') return bot;
  const out: TeamBotInput = { ...bot, profile: 'restricted', mode: 'auto' };
  if (isAgentModel(out.model)) delete out.model;
  if (isAgentModel(out.fallbackModel)) delete out.fallbackModel;
  if (out.permissions) out.permissions = { ...out.permissions, write: false };
  return out;
}

// Non-admin sees and touches bot routines only: a free cron is a turn with no bot,
// so no restricted profile, i.e. Bash on the box.
export function visibleCrons(crons: Cron[], role: Role | undefined): Cron[] {
  return role === 'admin' ? crons : crons.filter((c) => c.botId !== undefined);
}

export function cronWriteError(target: Pick<Cron, 'botId'> | undefined, role: Role | undefined): string | null {
  if (role === 'admin') return null;
  return target && target.botId !== undefined ? null : 'só rotinas de bot da Equipe';
}

// What a non-admin may save: a bot routine, never over a free cron with the same id,
// with the mode pinned and no ACP model (the bot's own settings win at fire time anyway).
export function coerceCronForRole(cron: Cron, existing: Cron | undefined, role: Role | undefined): { cron: Cron } | { error: string } {
  if (role === 'admin') return { cron };
  const err = cronWriteError(cron, role) ?? (existing ? cronWriteError(existing, role) : null);
  if (err) return { error: err };
  const out: Cron = { ...cron, mode: 'auto' };
  if (isAgentModel(out.model)) delete out.model;
  return { cron: out };
}
