import type { ModelInfo } from '../../shared/protocol';
import { isAgentModel } from '../../shared/agents';
import { modelFamily } from '../components/chat/toolbar-format';

// The pref stores what is HIDDEN, never what is visible: a model the account has
// never seen (new /v1/models id, new ACP agent, new family) is absent from the
// list and therefore shows up on its own.
export const FAMILY_PREFIX = 'family:';

export interface VisibleOption extends ModelInfo {
  hidden?: boolean;
}

export function familyKey(family: string): string {
  return FAMILY_PREFIX + family;
}

export function familyOf(id: string): string | null {
  return isAgentModel(id) ? null : modelFamily(id);
}

export function isHidden(id: string, hidden: readonly string[]): boolean {
  if (hidden.includes(id)) return true;
  const fam = familyOf(id);
  return !!fam && hidden.includes(familyKey(fam));
}

export function toggleHidden(hidden: readonly string[], key: string): string[] {
  return hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
}

// The selected model never disappears from the picker (the <select> would render
// another value than the one the next prompt uses), and hiding everything falls
// back to showing everything so the picker is never empty.
export function visibleOptions(opts: ModelInfo[], hidden: readonly string[], current: string): { options: VisibleOption[]; allHidden: boolean } {
  const shown = opts.filter((o) => !isHidden(o.id, hidden));
  if (opts.length > 0 && shown.length === 0) return { options: opts, allHidden: true };
  if (!current || shown.some((o) => o.id === current)) return { options: shown, allHidden: false };
  const exact = opts.find((o) => o.id === current);
  const fam = familyOf(current);
  // An alias ('opus') is covered by a concrete version of its family upstream; it
  // only needs re-adding when that whole family got filtered out.
  if (!exact && fam && shown.some((o) => familyOf(o.id) === fam)) return { options: shown, allHidden: false };
  if (!exact && !opts.some((o) => familyOf(o.id) === fam)) return { options: shown, allHidden: false };
  const pinned: VisibleOption = { ...(exact ?? { id: current, displayName: current }), hidden: true };
  return { options: [pinned, ...shown], allHidden: false };
}

export interface FamilyGroup<T extends ModelInfo = ModelInfo> {
  family: string;
  options: T[];
}

export function groupByFamily<T extends ModelInfo>(opts: T[]): FamilyGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const o of opts) {
    const fam = familyOf(o.id) ?? 'outros';
    const list = groups.get(fam);
    if (list) list.push(o);
    else groups.set(fam, [o]);
  }
  return [...groups].map(([family, options]) => ({ family, options }));
}
