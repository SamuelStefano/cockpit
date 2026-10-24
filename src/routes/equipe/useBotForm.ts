import { useState } from 'react';
import type { Effort, MascotShape, PermMode, TeamBot, TeamBotInput, TeamProfile } from '../../../shared/protocol';
import { newBotId, validateBotInput, wouldCycle } from '../../../shared/team';
import { MASCOT_COLORS } from '../../components/team/mascot-shapes';

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
}

export function draftFrom(bot: TeamBot | null, count: number): BotDraft {
  if (!bot) {
    return { name: '', label: '', instructions: '', shape: 'blob', color: MASCOT_COLORS[count % MASCOT_COLORS.length], parentId: '', primary: count === 0, profile: 'full', model: '', mode: '', effort: '' };
  }
  return {
    name: bot.name, label: bot.label, instructions: bot.instructions, shape: bot.mascot.shape, color: bot.mascot.color,
    parentId: bot.parentId ?? '', primary: !!bot.primary, profile: bot.profile, model: bot.model ?? '', mode: bot.mode ?? '', effort: bot.effort ?? '',
  };
}

export function toInput(id: string, d: BotDraft): TeamBotInput {
  const bot: TeamBotInput = { id, name: d.name.trim(), label: d.label.trim(), instructions: d.instructions, mascot: { shape: d.shape, color: d.color }, profile: d.profile };
  if (d.parentId) bot.parentId = d.parentId;
  if (d.primary) bot.primary = true;
  if (d.model) bot.model = d.model;
  if (d.mode) bot.mode = d.mode;
  if (d.effort) bot.effort = d.effort;
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

export function useBotForm(bot: TeamBot | null, bots: TeamBot[], onSave: (b: TeamBotInput) => void, onDone: () => void) {
  const [id] = useState(() => bot?.id ?? newBotId());
  const [draft, setDraft] = useState<BotDraft>(() => draftFrom(bot, bots.length));
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
