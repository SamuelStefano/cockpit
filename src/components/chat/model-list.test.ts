import { describe, it, expect } from 'vitest';
import { buildGroups } from './model-list';

const options = [
  { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' },
  { id: 'claude-haiku-5', displayName: 'Claude Haiku 5' },
  { id: 'agent:grok', displayName: 'Grok · agente' },
];
const base = { options, connections: [], favs: [] as string[], recents: [] as string[], query: '' };

describe('buildGroups', () => {
  it('groups by provider and puts favorites first', () => {
    const g = buildGroups({ ...base, favs: ['agent:grok'] });
    expect(g.map((x) => x.key)).toEqual(['fav', 'claude', 'xai']);
  });
  it('marks an expired provider disabled and adds a ghost for one with no models', () => {
    const g = buildGroups({ ...base, connections: [
      { id: 'provider:grok', kind: 'provider', label: 'Grok', state: 'expired' },
      { id: 'provider:gemini', kind: 'provider', label: 'Gemini', state: 'expired' },
    ] });
    expect(g.find((x) => x.key === 'xai')?.items[0].expired).toBe(true);
    expect(g.find((x) => x.key === 'google')?.items[0]).toMatchObject({ ghost: true, expired: true });
  });
  it('filters by capability words', () => {
    const g = buildGroups({ ...base, query: 'rápido' });
    expect(g.flatMap((x) => x.items.map((i) => i.id))).toEqual(['claude-haiku-5']);
  });
  it('suggests other providers first for a fallback and flags the same quota', () => {
    const g = buildGroups({ ...base, fallbackFor: 'claude' });
    expect(g[0].key).toBe('suggested');
    expect(g[0].items.map((i) => i.id)).toEqual(['agent:grok']);
    expect(g[1].items.every((i) => i.sameQuota)).toBe(true);
  });
});
