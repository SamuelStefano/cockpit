import type { PackRole, RegistryCatalog, RegistryPack, RegistryRef, RegistrySkill, SkillMeta } from '../../shared/protocol';

export interface PackMemberView {
  source: string;
  slug: string;
  role: PackRole;
  published: boolean;
  installed: boolean;
  description: string;
  author: string | null;
}

export interface PackView {
  pack: RegistryPack;
  members: PackMemberView[];
  installedCount: number;
  // Published, not installed, and installed by default (every role but suggested).
  missing: RegistryRef[];
  missingSuggested: RegistryRef[];
  complete: boolean;
}

export interface SkillGroup { label: string; items: SkillMeta[] }

const LOCAL_GROUP = 'Locais';

// A DFL skill that names no author is Tainan's (same rule as skills.devfellowship.com).
export function skillAuthor(s: Pick<RegistrySkill, 'author' | 'source'>): string {
  const owner = s.source.split('/')[0] ?? '';
  const named = s.author?.trim();
  if (named && named !== owner) return named;
  return owner === 'devfellowship' ? 'taigfs' : named || owner;
}

function registryIndex(catalog: RegistryCatalog | null): Map<string, RegistrySkill> {
  return new Map((catalog?.skills ?? []).map((s) => [s.slug, s]));
}

export function packView(pack: RegistryPack, installed: ReadonlySet<string>, catalog: RegistryCatalog | null): PackView {
  const index = registryIndex(catalog);
  const members = pack.members.map((m) => {
    const reg = index.get(m.slug);
    return {
      ...m,
      installed: installed.has(m.slug),
      description: reg?.description ?? '',
      author: reg ? skillAuthor(reg) : null,
    };
  });
  const pending = members.filter((m) => !m.installed && m.published);
  const missing = pending.filter((m) => m.role !== 'suggested').map(({ source, slug }) => ({ source, slug }));
  const missingSuggested = pending.filter((m) => m.role === 'suggested').map(({ source, slug }) => ({ source, slug }));
  return {
    pack,
    members,
    installedCount: members.filter((m) => m.installed).length,
    missing,
    missingSuggested,
    complete: missing.length === 0,
  };
}

// Installed skills: the packs they belong to first, then the rest grouped by the
// registry's first category; a skill the registry does not know is "Locais".
export function organizeInstalled(skills: SkillMeta[], catalog: RegistryCatalog | null): { packs: PackView[]; groups: SkillGroup[] } {
  const ids = new Set(skills.map((s) => s.id));
  const packs = (catalog?.packs ?? []).map((p) => packView(p, ids, catalog)).filter((v) => v.installedCount > 0);
  const inPack = new Set(packs.flatMap((v) => v.members.filter((m) => m.installed).map((m) => m.slug)));
  const index = registryIndex(catalog);
  const byGroup = new Map<string, SkillMeta[]>();
  for (const s of skills) {
    if (inPack.has(s.id)) continue;
    const reg = index.get(s.id);
    const label = reg ? capitalize(reg.categories[0] ?? 'geral') : LOCAL_GROUP;
    byGroup.set(label, [...(byGroup.get(label) ?? []), s]);
  }
  const groups = [...byGroup.entries()]
    .map(([label, items]) => ({ label, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => (a.label === LOCAL_GROUP ? 1 : b.label === LOCAL_GROUP ? -1 : b.items.length - a.items.length || a.label.localeCompare(b.label)));
  return { packs, groups };
}

export function discoverSkills(catalog: RegistryCatalog | null, installed: ReadonlySet<string>, query: string): RegistrySkill[] {
  const q = query.trim().toLowerCase();
  return (catalog?.skills ?? [])
    .filter((s) => !installed.has(s.slug))
    .filter((s) => !q || `${s.slug} ${s.name} ${s.description} ${s.tags.join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function matchesQuery(s: SkillMeta, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || `${s.id} ${s.name} ${s.description}`.toLowerCase().includes(q);
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1).replace(/-/g, ' ') : s;
}
