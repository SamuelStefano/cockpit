import type { BotPermissions, TeamProfile } from './protocol';

export const ALL_PERMISSIONS: BotPermissions = { read: true, write: true, net: true };

const READ_TOOLS = ['Read', 'Glob', 'Grep'];
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'Bash'];
const NET_TOOLS = ['WebFetch', 'WebSearch'];

export function permissionsFromProfile(profile: TeamProfile): BotPermissions {
  return profile === 'full' ? ALL_PERMISSIONS : { read: true, write: false, net: true };
}

export function profileFromPermissions(p: BotPermissions): TeamProfile {
  return p.read && p.write && p.net ? 'full' : 'restricted';
}

export function toolsDeniedBy(p: BotPermissions): string[] {
  return [...(p.read ? [] : READ_TOOLS), ...(p.write ? [] : WRITE_TOOLS), ...(p.net ? [] : NET_TOOLS)];
}

export function parsePermissions(raw: unknown): BotPermissions | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.read !== 'boolean' || typeof r.write !== 'boolean' || typeof r.net !== 'boolean') return null;
  return { read: r.read, write: r.write, net: r.net };
}

export const MAX_BOT_SKILLS = 300;
const SKILL_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;

export function parseSkillIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_BOT_SKILLS) return null;
  if (!raw.every((x) => typeof x === 'string' && SKILL_ID_RE.test(x))) return null;
  return [...new Set(raw as string[])];
}

export function botRunsSkill(bot: { skills?: string[] }, skillId: string): boolean {
  return !bot.skills || bot.skills.length === 0 || bot.skills.includes(skillId);
}

// Empty and full selections both mean "no list": every skill, today's behavior.
export function withSkillToggled(current: string[] | undefined, all: readonly string[], skillId: string, on: boolean): string[] | undefined {
  const base = new Set(current && current.length ? current : all);
  if (on) base.add(skillId); else base.delete(skillId);
  const next = all.filter((id) => base.has(id));
  if (next.length === all.length || next.length === 0) return undefined;
  return next;
}
