import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message } from '../../shared/protocol';
import type { Rec } from './records';
import { readRecords } from './records';
import { _resetPeekCache, extractUrls, peekFromRecords, peekSession, PEEK_TAIL_CHARS, tailText } from './peek';

const file = join(mkdtempSync(join(tmpdir(), 'peek-')), 's.jsonl');
vi.mock('./records', async (orig) => ({
  ...(await orig<typeof import('./records')>()),
  sessionPath: (id: string) => (id === 'bad' ? null : file),
  readRecords: vi.fn(async () => ({ byUuid: new Map(), msgs: [], results: new Map(), markers: [] })),
}));

const asst = (text: string, ts = '2026-09-24T10:00:00Z'): Rec => ({
  type: 'assistant', uuid: text.slice(0, 8), timestamp: ts,
  message: { role: 'assistant', content: [{ type: 'text', text }] },
});
const user = (text: string): Rec => ({ type: 'user', uuid: `u-${text}`, message: { role: 'user', content: text } });
const toolOnly: Rec = { type: 'assistant', uuid: 'tool', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }] } };

describe('extractUrls', () => {
  it('strips trailing punctuation and markdown wrappers', () => {
    expect(extractUrls('see https://a.dev/x. and (https://b.dev/y) or **https://c.dev/z**')).toEqual([
      'https://a.dev/x', 'https://b.dev/y', 'https://c.dev/z',
    ]);
  });
});

describe('tailText', () => {
  it('keeps short text as-is', () => {
    expect(tailText('done')).toBe('done');
  });

  it('keeps the end of long text, capped', () => {
    const out = tailText(`${'a'.repeat(1000)}END`);
    expect(out.endsWith('END')).toBe(true);
    expect(out.startsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(PEEK_TAIL_CHARS);
  });
});

describe('peekFromRecords', () => {
  it('returns the last assistant text, skipping tool-only turns and user messages', () => {
    const peek = peekFromRecords([asst('first'), asst('final answer', '2026-09-24T11:00:00Z'), toolOnly, user('thanks')], []);
    expect(peek.lastAssistant).toBe('final answer');
    expect(peek.lastAt).toBe(Date.parse('2026-09-24T11:00:00Z'));
  });

  it('pulls PRs out of assistant text and merges pr-link markers without duplicates', () => {
    const markers: Message[] = [{ id: 'pr-x', role: 'compact', kind: 'pr', label: 'PR #614 · o/cockpit', url: 'https://github.com/o/cockpit/pull/614' }];
    const peek = peekFromRecords([asst('Opened https://github.com/o/cockpit/pull/614 and https://github.com/o/other/pull/7.')], markers);
    expect(peek.prs).toEqual([
      { url: 'https://github.com/o/cockpit/pull/614', label: 'PR #614 · o/cockpit' },
      { url: 'https://github.com/o/other/pull/7', label: 'PR #7 · o/other' },
    ]);
    expect(peek.links).toEqual([]);
  });

  it('lists other links most recent first, deduped, ignoring user text', () => {
    const peek = peekFromRecords([
      asst('old https://a.dev/1'),
      user('check https://user.dev/secret'),
      asst('new https://b.dev/2 then https://a.dev/1'),
    ], []);
    expect(peek.links).toEqual(['https://a.dev/1', 'https://b.dev/2']);
  });

  it('is empty for a transcript with no assistant text', () => {
    expect(peekFromRecords([user('hi'), toolOnly], [])).toEqual({ lastAssistant: undefined, lastAt: undefined, prs: [], links: [] });
  });
});

describe('peekSession cache', () => {
  beforeEach(() => {
    _resetPeekCache();
    vi.mocked(readRecords).mockClear();
    writeFileSync(file, 'a');
  });

  it('reparses only when mtime or size changes', async () => {
    await peekSession('s1');
    await peekSession('s1');
    expect(readRecords).toHaveBeenCalledTimes(1);
    writeFileSync(file, 'ab');
    await peekSession('s1');
    expect(readRecords).toHaveBeenCalledTimes(2);
    utimesSync(file, new Date(), new Date(Date.now() + 5000));
    await peekSession('s1');
    expect(readRecords).toHaveBeenCalledTimes(3);
  });

  it('shares one read between concurrent requests', async () => {
    const [a, b] = await Promise.all([peekSession('s1'), peekSession('s1')]);
    expect(readRecords).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('returns null for an invalid id', async () => {
    expect(await peekSession('bad')).toBeNull();
    expect(readRecords).not.toHaveBeenCalled();
  });
});
