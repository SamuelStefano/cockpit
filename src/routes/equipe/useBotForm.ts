import { useState } from 'react';
import type { BotPermissions, Effort, MascotShape, PermMode, TeamBot, TeamBotInput, TeamProfile } from '../../../shared/protocol';
import { newBotId, validateBotInput, wouldCycle } from '../../../shared/team';
import { MASCOT_COLORS } from '../../components/team/mascot-shapes';
import { isAgentModel } from '../../../shared/agents';

export interface BotDraft {
  name: string;
  label: string;
  instructions: string;
  shape: MascotShape;
  color: string;
  parentId: string;
  primary: boolean;
  profile: TeamProfile;
  model: string;
  mode: PermMode | '';
  effort: Effort | '';
  permissions?: BotPermissions;
  skills: string[];
}

// locked = what the server forces on a non-admin's bot, shown up front in the form.
export function draftFrom(bot: TeamBot | null, count: number, locked = false): BotDraft {
  const d = baseDraft(bot, count);
  return locked ? { ...d, profile: 'restricted', mode: 'auto', model: isAgentModel(d.model) ? '' : d.model, ...(d.permissions ? { permissions: { ...d.permissions, write: false } } : {}) } : d;
}

function baseDraft(bot: TeamBot | null, count: number): BotDraft {
  if (!bot) {
    return { name: '', label: '', instructions: '', shape: 'blob', color: MASCOT_COLORS[count % MASCOT_COLORS.length], parentId: '', primary: count === 0, profile: 'full', model: '', mode: '', effort: '', skills: [] };
  }
  return {
    name: bot.name, label: bot.label, instructions: bot.instructions, shape: bot.mascot.shape, color: bot.mascot.color,
    parentId: bot.parentId ?? '', primary: !!bot.primary, profile: bot.profile, model: bot.model ?? '', mode: bot.mode ?? '', effort: bot.effort ?? '',
    skills: bot.skills ?? [],
    ...(bot.permissions ? { permissions: bot.permissions } : {}),
  };
}

export function toInput(id: string, d: BotDraft): TeamBotInput {
  const bot: TeamBotInput = { id, name: d.name.trim(), label: d.label.trim(), instructions: d.instructions, mascot: { shape: d.shape, color: d.color }, profile: d.profile };
  if (d.parentId) bot.parentId = d.parentId;
  if (d.primary) bot.primary = true;
  if (d.model) bot.model = d.model;
  if (d.mode) bot.mode = d.mode;
  if (d.effort) bot.effort = d.effort;
  if (d.permissions) bot.permissions = d.permissions;
  if (d.skills.length) bot.skills = d.skills;
  return bot;
}

export function withLabel(bot: TeamBot, label: string): TeamBotInput {
  const { sessionId: _s, createdAt: _c, updatedAt: _u, ...input } = bot;
  return { ...input, label: label.trim() };
}

// Same rules the server enforces, so the form says what is wrong before a round trip.
export function draftError(id: string, d: BotDraft, bots: TeamBot[]): string | null {
  const v = validateBotInput(toInput(id, d));
  if (!v.ok) return v.error;
  if (wouldCycle(bots, id, d.parentId || undefined)) return 'essa chefia formaria um ciclo';
  if (bots.some((b) => b.id !== id && b.name.toLowerCase() === d.name.trim().toLowerCase())) return 'já existe um bot com esse nome';
  return null;
}

export function useBotForm(bot: TeamBot | null, bots: TeamBot[], onSave: (b: TeamBotInput) => void, onDone: () => void, locked = false) {
  const [id] = useState(() => bot?.id ?? newBotId());
  const [draft, setDraft] = useState<BotDraft>(() => draftFrom(bot, bots.length, locked));
  const [touched, setTouched] = useState(false);
  const error = draftError(id, draft, bots);
  const set = <K extends keyof BotDraft>(k: K, v: BotDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const submit = () => {
    setTouched(true);
    if (error) return;
    onSave(toInput(id, draft));
    onDone();
  };
  const parents = bots.filter((b) => b.id !== id && !wouldCycle(bots, id, b.id));
  return { id, draft, set, error: touched ? error : null, submit, parents };
}
