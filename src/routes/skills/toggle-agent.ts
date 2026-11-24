import type { SkillMeta, TeamBot, TeamBotInput } from '../../../shared/protocol';
import { withSkillToggled } from '../../../shared/bot-access';

export function botWithSkillToggled(bot: TeamBot, all: SkillMeta[], skillId: string, on: boolean): TeamBotInput {
  const { sessionId: _s, createdAt: _c, updatedAt: _u, skills: _k, ...input } = bot;
  const skills = withSkillToggled(bot.skills, all.map((s) => s.id), skillId, on);
  return skills ? { ...input, skills } : input;
}
