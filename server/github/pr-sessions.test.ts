import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { indexPrSessions, parsePrLinks } from './pr-sessions';

const rec = (sessionId: string, prUrl: string, timestamp: string) => JSON.stringify({ type: 'pr-link', sessionId, prNumber: 1, prUrl, timestamp });

describe('parsePrLinks', () => {
  it('maps each PR to the earliest session that linked it', () => {
    const text = [
      rec('later', 'https://github.com/a/b/pull/1', '2026-11-07T10:00:00Z'),
      rec('creator', 'https://github.com/a/b/pull/1', '2026-11-06T10:00:00Z'),
      rec('s2', 'https://github.com/a/b/pull/2', '2026-11-06T10:00:00Z'),
      '{"type":"user","message":"mentions \\"pr-link\\" in text"}',
      'not json "pr-link"',
    ].join('\n');
    expect([...parsePrLinks(text)]).toEqual([['https://github.com/a/b/pull/1', 'creator'], ['https://github.com/a/b/pull/2', 's2']]);
  });
});

describe('indexPrSessions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pr-sessions-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('greps the transcripts and treats no match as an empty index', async () => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    writeFileSync(join(empty, 'x.jsonl'), '{"type":"user"}\n');
    expect((await indexPrSessions(empty)).size).toBe(0);

    const full = join(dir, 'full');
    mkdirSync(join(full, 'sub'), { recursive: true });
    writeFileSync(join(full, 'sub', 'a.jsonl'), `${rec('sa', 'https://github.com/a/b/pull/9', '2026-11-01T00:00:00Z')}\n`);
    writeFileSync(join(full, 'notes.txt'), `${rec('nope', 'https://github.com/a/b/pull/10', '2026-11-01T00:00:00Z')}\n`);
    const map = await indexPrSessions(full);
    expect([...map]).toEqual([['https://github.com/a/b/pull/9', 'sa']]);
  });
});
