import { describe, it, expect } from 'vitest';
import type { RegistryCatalog, SkillMeta } from '../../shared/protocol';
import { filterSkills, sourceChips, usedByLabel } from './skill-view';

const sk = (id: string, over: Partial<SkillMeta> = {}): SkillMeta => ({ id, name: id, description: '', mtime: 0, ...over });
const SKILLS = [
  sk('pdf'),
  sk('campaigns', { source: 'dfl-campaigns', risk: ['read'] }),
  sk('post', { source: 'dfl-campaigns', risk: ['write', 'net'] }),
  sk('mine-only'),
];
const REG = { skills: [{ slug: 'pdf' }], packs: [], fetchedAt: 0 } as unknown as RegistryCatalog;

describe('sourceChips', () => {
  it('lists Deck first, then host MCPs, and Minhas only when the registry is known', () => {
    expect(sourceChips(SKILLS, REG).map((c) => c.label)).toEqual(['Todas', 'Deck', 'dfl-campaigns', 'Minhas']);
    expect(sourceChips(SKILLS, null).map((c) => c.label)).toEqual(['Todas', 'Deck', 'dfl-campaigns']);
  });
});

describe('filterSkills', () => {
  it('filters by source', () => {
    expect(filterSkills(SKILLS, 'src:dfl-campaigns', 'any', REG).map((s) => s.id)).toEqual(['campaigns', 'post']);
    expect(filterSkills(SKILLS, 'mine', 'any', REG).map((s) => s.id)).toEqual(['mine-only']);
  });
  it('treats a skill without risk as read-only', () => {
    expect(filterSkills(SKILLS, 'all', 'read', REG).map((s) => s.id)).toEqual(['pdf', 'campaigns', 'mine-only']);
    expect(filterSkills(SKILLS, 'all', 'write', REG).map((s) => s.id)).toEqual(['post']);
  });
});

describe('usedByLabel', () => {
  it('speaks plainly', () => {
    expect(usedByLabel(0)).toBe('nenhum agente');
    expect(usedByLabel(1)).toBe('1 agente');
    expect(usedByLabel(3)).toBe('3 agentes');
  });
});
