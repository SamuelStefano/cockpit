import type { ModelInfo } from '../../../shared/protocol';
import { isAgentModel } from '../../../shared/agents';
import { modelFamily } from './toolbar-format';
import { visibleOptions, type VisibleOption } from '../../lib/model-visibility';

// Versão concreta do agente, puxada de /v1/models pelo backend. Sem a lista
// (boot/offline) cai nos aliases opus/sonnet/haiku, que o CLI aceita. Fable has no
// CLI alias, so it is listed by its concrete id or it never shows up offline.
export const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'claude-fable-5-1', displayName: 'Fable 5.1' },
  { id: 'opus', displayName: 'Opus' },
  { id: 'sonnet', displayName: 'Sonnet' },
  { id: 'haiku', displayName: 'Haiku' },
];

// A conta pode expor só uma família concreta em /v1/models (ex: só Opus 4.8). Pra
// não deixar o seletor com uma opção só, completamos com os aliases das famílias
// ausentes (sonnet/haiku) — o CLI aceita o alias e resolve a versão mais recente.
export function withFamilies(models: ModelInfo[]): ModelInfo[] {
  const have = new Set(models.map((m) => FALLBACK_MODELS.find((f) => m.id.includes(f.id))?.id));
  const extra = FALLBACK_MODELS.filter((f) => !have.has(f.id));
  return [...models, ...extra];
}

// Lista final do seletor. Garante que `current` apareça mesmo fora de /v1/models
// (modelo descontinuado) — senão o select renderiza vazio. Mas se já existe uma
// versão concreta da MESMA família (ex: 'opus' salvo e 'claude-opus-4-8' na lista),
// não duplicamos.
export function modelOptions(models: ModelInfo[], current: string, extra: ModelInfo[] = []): ModelInfo[] {
  const opts = [...(models.length ? withFamilies(models) : FALLBACK_MODELS), ...extra];
  const fam = modelFamily(current);
  const covered = opts.some((o) => o.id === current) || (fam && opts.some((o) => modelFamily(o.id) === fam));
  return covered ? opts : [{ id: current, displayName: current }, ...opts];
}

export function splitAgentModels<T extends ModelInfo>(opts: T[]): { models: T[]; agents: T[] } {
  return { models: opts.filter((o) => !isAgentModel(o.id)), agents: opts.filter((o) => isAgentModel(o.id)) };
}

function uniqueById<T extends ModelInfo>(opts: T[]): T[] {
  return opts.filter((o, i, a) => a.findIndex((x) => x.id === o.id) === i);
}

export function customModelOptions(ids: string[]): ModelInfo[] {
  return ids.map((id) => ({ id, displayName: id }));
}

// Everything the account can pick, with nothing hidden — the Admin lists it so a
// hidden model can be turned back on.
export function catalogOptions(models: ModelInfo[], customIds: string[]): ModelInfo[] {
  return uniqueById([...(models.length ? withFamilies(models) : FALLBACK_MODELS), ...customModelOptions(customIds)]);
}

export interface PickerGroups {
  all: VisibleOption[];
  anthropic: VisibleOption[];
  others: VisibleOption[];
  allHidden: boolean;
}

export function pickerGroups(models: ModelInfo[], current: string, customIds: string[], hidden: readonly string[]): PickerGroups {
  const list = uniqueById(modelOptions(models, current, customModelOptions(customIds)));
  const { options, allHidden } = visibleOptions(list, hidden, current);
  const split = splitAgentModels(options);
  return { all: options, anthropic: split.models, others: split.agents, allHidden };
}
