import type { RegistryCatalog, SkillMeta, SkillRisk } from '../../shared/protocol';

export type SourceFilter = 'all' | 'mine' | `src:${string}`;
export type RiskFilter = 'any' | 'read' | 'write';

export const sourceOf = (s: SkillMeta): string => s.source || 'deck';
export const sourceLabel = (source: string): string => (source === 'deck' ? 'Deck' : source);
export const risksOf = (s: SkillMeta): SkillRisk[] => (s.risk && s.risk.length ? s.risk : ['read']);

function isMine(s: SkillMeta, registry: RegistryCatalog | null): boolean {
  return !!registry && sourceOf(s) === 'deck' && !registry.skills.some((r) => r.slug === s.id);
}

export function sourceChips(skills: SkillMeta[], registry: RegistryCatalog | null): { id: SourceFilter; label: string }[] {
  const sources = [...new Set(skills.map(sourceOf))].sort((a, b) => (a === 'deck' ? -1 : b === 'deck' ? 1 : a.localeCompare(b)));
  const chips: { id: SourceFilter; label: string }[] = [{ id: 'all', label: 'Todas' }, ...sources.map((x) => ({ id: `src:${x}` as SourceFilter, label: sourceLabel(x) }))];
  if (skills.some((s) => isMine(s, registry))) chips.push({ id: 'mine', label: 'Minhas' });
  return chips;
}

export function filterSkills(skills: SkillMeta[], source: SourceFilter, risk: RiskFilter, registry: RegistryCatalog | null): SkillMeta[] {
  return skills.filter((s) => {
    if (source === 'mine' && !isMine(s, registry)) return false;
    if (source.startsWith('src:') && sourceOf(s) !== source.slice(4)) return false;
    const r = risksOf(s);
    if (risk === 'read') return r.length === 1 && r[0] === 'read';
    if (risk === 'write') return r.includes('write');
    return true;
  });
}

export function usedByLabel(n: number): string {
  if (n === 0) return 'nenhum agente';
  return n === 1 ? '1 agente' : `${n} agentes`;
}
