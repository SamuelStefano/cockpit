import type { SkillMeta } from '../../../shared/protocol';
import { risksOf } from '../../lib/skill-view';

export interface SkillPreset {
  id: string;
  label: string;
  pick: (skills: SkillMeta[]) => string[];
}

export const SKILL_PRESETS: SkillPreset[] = [
  { id: 'all', label: 'Todas', pick: () => [] },
  { id: 'reader', label: 'Pesquisador (só lê)', pick: (skills) => skills.filter((s) => risksOf(s).every((r) => r === 'read')).map((s) => s.id) },
  { id: 'no-net', label: 'Sem rede', pick: (skills) => skills.filter((s) => !risksOf(s).includes('net')).map((s) => s.id) },
];

export function selectedIds(skills: SkillMeta[], value: string[]): Set<string> {
  return new Set(value.length ? value : skills.map((s) => s.id));
}

export function toggleSelection(skills: SkillMeta[], value: string[], id: string): string[] {
  const set = selectedIds(skills, value);
  if (set.has(id)) set.delete(id); else set.add(id);
  if (set.size === 0) return value;
  const next = skills.filter((s) => set.has(s.id)).map((s) => s.id);
  return next.length === skills.length ? [] : next;
}

export function searchSkills(skills: SkillMeta[], q: string): SkillMeta[] {
  const n = q.trim().toLowerCase();
  return n ? skills.filter((s) => `${s.id} ${s.name} ${s.description}`.toLowerCase().includes(n)) : skills;
}

export function groupBySource(skills: SkillMeta[], sourceOf: (s: SkillMeta) => string): [string, SkillMeta[]][] {
  const map = new Map<string, SkillMeta[]>();
  for (const s of skills) map.set(sourceOf(s), [...(map.get(sourceOf(s)) ?? []), s]);
  return [...map.entries()].sort(([a], [b]) => (a === 'deck' ? -1 : b === 'deck' ? 1 : a.localeCompare(b)));
}
