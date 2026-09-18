import { describe, it, expect } from 'vitest';
import type { RegistryCatalog, RegistrySkill, SkillMeta } from '../../shared/protocol';
import { discoverSkills, organizeInstalled, packView, skillAuthor } from './skill-packs';

const SRC = 'devfellowship/internal-skills';
const reg = (slug: string, over: Partial<RegistrySkill> = {}): RegistrySkill => ({
  source: SRC, slug, name: slug, description: `${slug} desc`, author: null, tags: [], categories: ['content'], visibility: 'internal', ...over,
});
const local = (id: string): SkillMeta => ({ id, name: id, description: '', mtime: 0 });

const CATALOG: RegistryCatalog = {
  fetchedAt: 0,
  skills: [reg('director'), reg('studio'), reg('reel', { author: 'SamuelStefano' }), reg('launch'), reg('app-security', { categories: ['security'] })],
  packs: [{
    source: SRC, slug: 'short-form-visual', name: 'Short-form', description: '', root: 'director',
    members: [
      { source: SRC, slug: 'director', role: 'root', published: true },
      { source: SRC, slug: 'studio', role: 'required', published: true },
      { source: SRC, slug: 'reel', role: 'optional', published: true },
      { source: SRC, slug: 'ghost', role: 'optional', published: false },
      { source: SRC, slug: 'launch', role: 'suggested', published: true },
    ],
  }],
};

describe('packView', () => {
  it('lists what is missing by default, keeps suggested apart and ignores unpublished members', () => {
    const v = packView(CATALOG.packs[0], new Set(['reel']), CATALOG);
    expect(v.installedCount).toBe(1);
    expect(v.missing.map((r) => r.slug)).toEqual(['director', 'studio']);
    expect(v.missingSuggested.map((r) => r.slug)).toEqual(['launch']);
    expect(v.complete).toBe(false);
    expect(v.members.find((m) => m.slug === 'reel')?.author).toBe('SamuelStefano');
    expect(v.members.find((m) => m.slug === 'studio')?.author).toBe('taigfs');
  });

  it('is complete once every default member is installed', () => {
    expect(packView(CATALOG.packs[0], new Set(['director', 'studio', 'reel']), CATALOG).complete).toBe(true);
  });
});

describe('organizeInstalled', () => {
  it('puts pack members under their pack and groups the rest, local skills last', () => {
    const { packs, groups } = organizeInstalled([local('reel'), local('app-security'), local('my-own')], CATALOG);
    expect(packs.map((p) => p.pack.slug)).toEqual(['short-form-visual']);
    expect(groups).toEqual([
      { label: 'Security', items: [local('app-security')] },
      { label: 'Locais', items: [local('my-own')] },
    ]);
  });

  it('without a catalog every skill is local', () => {
    expect(organizeInstalled([local('a')], null)).toEqual({ packs: [], groups: [{ label: 'Locais', items: [local('a')] }] });
  });
});

describe('discoverSkills', () => {
  it('shows only registry skills not installed, filtered by the query', () => {
    expect(discoverSkills(CATALOG, new Set(['director']), '').map((s) => s.slug)).toEqual(['app-security', 'launch', 'reel', 'studio']);
    expect(discoverSkills(CATALOG, new Set(), 'secur').map((s) => s.slug)).toEqual(['app-security']);
  });
});

describe('skillAuthor', () => {
  it('names the skill author, else taigfs for DFL, else the owner', () => {
    expect(skillAuthor({ source: SRC, author: 'SamuelStefano' })).toBe('SamuelStefano');
    expect(skillAuthor({ source: SRC, author: 'devfellowship' })).toBe('taigfs');
    expect(skillAuthor({ source: 'someone/x', author: null })).toBe('someone');
  });
});
