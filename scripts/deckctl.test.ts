import { describe, expect, it } from 'vitest';
import {
  parseFlags, flagStr, flagNum, fmtBrt, shortId, oneLine, matchByPrefix, newCardIdLocal, findCard,
} from './deckctl.mts';
import type { CanvasCard } from '../shared/canvas';

describe('parseFlags', () => {
  it('splits positional args from --flags', () => {
    const { positional, flags } = parseFlags(['sessions', '--all', '--limit', '5']);
    expect(positional).toEqual(['sessions']);
    expect(flags).toEqual({ all: true, limit: '5' });
  });

  it('treats a flag followed by another flag as a boolean', () => {
    const { flags } = parseFlags(['--json', '--all']);
    expect(flags).toEqual({ json: true, all: true });
  });

  it('treats a trailing flag with no value as boolean', () => {
    const { flags } = parseFlags(['--json']);
    expect(flags).toEqual({ json: true });
  });

  it('keeps quoted text with spaces as one positional', () => {
    const { positional } = parseFlags(['send', 'abcd1234', 'reply with OK']);
    expect(positional).toEqual(['send', 'abcd1234', 'reply with OK']);
  });
});

describe('flagStr / flagNum', () => {
  it('reads a string flag', () => {
    expect(flagStr({ model: 'haiku' }, 'model')).toBe('haiku');
  });

  it('returns undefined for a boolean flag', () => {
    expect(flagStr({ all: true }, 'all')).toBeUndefined();
  });

  it('parses a numeric flag', () => {
    expect(flagNum({ limit: '5' }, 'limit')).toBe(5);
  });

  it('returns undefined for a non-numeric value', () => {
    expect(flagNum({ limit: 'abc' }, 'limit')).toBeUndefined();
  });

  it('returns undefined when the flag is absent', () => {
    expect(flagNum({}, 'limit')).toBeUndefined();
  });
});

describe('fmtBrt', () => {
  it('renders a fixed instant in America/Sao_Paulo time', () => {
    // 2026-09-23T23:19:00Z = 20:19 in BRT (UTC-3).
    const ms = Date.UTC(2026, 8, 23, 23, 19, 0);
    expect(fmtBrt(ms)).toBe('23/09, 20:19 BRT');
  });
});

describe('shortId', () => {
  it('truncates a uuid to 8 chars', () => {
    expect(shortId('faf5b231-c2d7-419b-9765-3f277670564e')).toBe('faf5b231');
  });

  it('leaves a short id untouched', () => {
    expect(shortId('abc')).toBe('abc');
  });
});

describe('oneLine', () => {
  it('collapses newlines and whitespace runs', () => {
    expect(oneLine('a\n\nb   c\t d')).toBe('a b c d');
  });

  it('caps length and adds an ellipsis', () => {
    const s = 'x'.repeat(100);
    const out = oneLine(s, 10);
    expect(out).toBe('xxxxxxxxx…');
    expect(out.length).toBe(10);
  });

  it('leaves short text untouched', () => {
    expect(oneLine('hello', 70)).toBe('hello');
  });
});

describe('matchByPrefix', () => {
  const ids = ['faf5b231-aaaa', 'faf5b231-bbbb', '6f9ed1d0-cccc'];

  it('resolves an unambiguous prefix', () => {
    expect(matchByPrefix(ids, '6f9ed1d0')).toEqual({ kind: 'ok', id: '6f9ed1d0-cccc' });
  });

  it('prefers an exact match over a prefix collision', () => {
    expect(matchByPrefix(ids, 'faf5b231-aaaa')).toEqual({ kind: 'ok', id: 'faf5b231-aaaa' });
  });

  it('flags an ambiguous prefix with all matches', () => {
    expect(matchByPrefix(ids, 'faf5b231')).toEqual({ kind: 'ambiguous', matches: ['faf5b231-aaaa', 'faf5b231-bbbb'] });
  });

  it('reports none when nothing matches', () => {
    expect(matchByPrefix(ids, 'zzzz')).toEqual({ kind: 'none' });
  });
});

describe('newCardIdLocal', () => {
  it('produces an id matching CARD_ID_RE shape (lowercase, digits, hyphens)', () => {
    const id = newCardIdLocal('Fix the Canvas Kanban!');
    expect(id).toMatch(/^[a-z0-9-]{4,40}$/);
    expect(id).toContain('fix-the-canvas-kanban');
  });

  it('falls back to a plain random id for an all-punctuation title', () => {
    const id = newCardIdLocal('!!!');
    expect(id).toMatch(/^[a-z0-9-]{4,40}$/);
  });
});

describe('findCard', () => {
  const base = { title: 't', prompt: '', status: 'todo' as const, kind: 'task' as const, contextIds: [], sessionIds: [], createdAt: 0, updatedAt: 0 };
  const cards: CanvasCard[] = [
    { ...base, id: 'card-abcd1234' },
    { ...base, id: 'card-abcd5678' },
  ];

  it('resolves an unambiguous prefix to the full card', () => {
    expect(findCard(cards, 'card-abcd1234').id).toBe('card-abcd1234');
  });

  it('resolves a shorter unique prefix', () => {
    // 'card-abcd1234' vs 'card-abcd5678' both share 'card-abcd' — use a fully
    // distinguishing prefix so this asserts the SUCCESS path, not ambiguity.
    expect(findCard(cards, 'card-abcd12').id).toBe('card-abcd1234');
  });
});
