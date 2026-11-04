import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendBotMessage, trimBotMessages } from './history.ts';

describe('bot message history', () => {
  it('appends one private JSON line per message and keeps the newest on trim', async () => {
    const f = join(await mkdtemp(join(tmpdir(), 'hist-')), 'h.jsonl');
    for (const text of ['a\nb', 'c', 'd']) await appendBotMessage(f, text, () => new Date(0));
    expect(JSON.parse((await readFile(f, 'utf8')).split('\n')[0])).toEqual({ t: '1970-01-01T00:00:00.000Z', text: 'a\nb' });
    expect((await stat(f)).mode & 0o777).toBe(0o600);
    await trimBotMessages(f, 2);
    expect((await readFile(f, 'utf8')).trim().split('\n').map((l) => JSON.parse(l).text)).toEqual(['c', 'd']);
    expect((await stat(f)).mode & 0o777).toBe(0o600);
  });
});
