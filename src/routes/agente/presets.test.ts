import { describe, it, expect } from 'vitest';
import type { SkillMeta } from '../../../shared/protocol';
import { SKILL_PRESETS, groupBySource, searchSkills, toggleSelection } from './presets';
import { sourceOf } from '../../lib/skill-view';

const mk = (id: string, over: Partial<SkillMeta> = {}): SkillMeta => ({ id, name: id, description: '', mtime: 0, ...over });
const all = [mk('a'), mk('b', { risk: ['write'] }), mk('c', { risk: ['net'], source: 'dfl-work' })];

describe('skill presets', () => {
  it('Pesquisador keeps only read-only skills', () => {
    expect(SKILL_PRESETS.find((p) => p.id === 'reader')!.pick(all)).toEqual(['a']);
  });
  it('Todas clears the list', () => expect(SKILL_PRESETS[0].pick(all)).toEqual([]));
});

describe('selection', () => {
  it('turning one off from "all" lists the others; back to all clears', () => {
    const off = toggleSelection(all, [], 'b');
    expect(off).toEqual(['a', 'c']);
    expect(toggleSelection(all, off, 'b')).toEqual([]);
  });
  it('refuses to empty the list', () => expect(toggleSelection(all, ['a'], 'a')).toEqual(['a']));
  it('searches and groups with deck first', () => {
    expect(searchSkills(all, 'C').map((s) => s.id)).toEqual(['c']);
    expect(groupBySource(all, sourceOf).map(([k]) => k)).toEqual(['deck', 'dfl-work']);
  });
});
