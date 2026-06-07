import { describe, it, expect } from 'vitest';
import { filterSessions } from './filter';
import type { Session } from '../../data/mock';

const s = (id: string, title: string, snippet = ''): Session => ({
  id, title, snippet, relative: '', mtime: 0, hasTerminal: false, active: false,
});

const A = s('a', 'Alpha refactor', 'touches the parser');
const B = s('b', 'Beta deploy', 'ship the build');
const C = s('c', 'Gamma notes', 'random text');
const ALL = [A, B, C];
const NO_PIN = new Set<string>();

describe('filterSessions', () => {
  it('returns all sessions when query is empty', () => {
    expect(filterSessions(ALL, '', [], NO_PIN, null, {})).toEqual(ALL);
    expect(filterSessions(ALL, '   ', [], NO_PIN, null, {})).toEqual(ALL);
  });

  it('filters locally by title and snippet, case-insensitively', () => {
    expect(filterSessions(ALL, 'beta', [], NO_PIN, null, {})).toEqual([B]);
    expect(filterSessions(ALL, 'PARSER', [], NO_PIN, null, {})).toEqual([A]);
  });

  it('merges content-search hits without duplicating local matches', () => {
    // B matches locally; search backend also returns B (dup) plus C (content-only).
    const out = filterSessions(ALL, 'beta', [B, C], NO_PIN, null, {});
    expect(out).toEqual([B, C]);
  });

  it('restricts to the selected tag', () => {
    const tagMap = { a: ['work'], b: ['work', 'urgent'], c: ['home'] };
    expect(filterSessions(ALL, '', [], NO_PIN, 'urgent', tagMap)).toEqual([B]);
    expect(filterSessions(ALL, '', [], NO_PIN, 'work', tagMap)).toEqual([A, B]);
  });

  it('floats pinned sessions to the top, preserving relative order', () => {
    const out = filterSessions(ALL, '', [], new Set(['c']), null, {});
    expect(out.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('preserves order among multiple pins', () => {
    const out = filterSessions(ALL, '', [], new Set(['b', 'c']), null, {});
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('applies tag filter then pin ordering together', () => {
    const tagMap = { a: ['work'], b: ['work'], c: ['home'] };
    const out = filterSessions(ALL, '', [], new Set(['b']), 'work', tagMap);
    expect(out.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
