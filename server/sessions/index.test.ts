import { describe, it, expect } from 'vitest';
import { metaForId, relTime, metaFromHead } from './index';

const VALID = '12345678-1234-1234-1234-123456789abc';

describe('relTime', () => {
  const now = 1_000_000_000_000;
  const ago = (ms: number) => now - ms;
  it('reports "agora" under a minute', () => {
    expect(relTime(ago(0), now)).toBe('agora');
    expect(relTime(ago(59_000), now)).toBe('agora');
  });
  it('reports minutes under an hour', () => {
    expect(relTime(ago(60_000), now)).toBe('1min atrás');
    expect(relTime(ago(59 * 60_000), now)).toBe('59min atrás');
  });
  it('reports hours under a day', () => {
    expect(relTime(ago(60 * 60_000), now)).toBe('1h atrás');
    expect(relTime(ago(23 * 60 * 60_000), now)).toBe('23h atrás');
  });
  it('reports "ontem" at exactly one day', () => {
    expect(relTime(ago(24 * 60 * 60_000), now)).toBe('ontem');
  });
  it('reports days past one day', () => {
    expect(relTime(ago(2 * 24 * 60 * 60_000), now)).toBe('2d atrás');
  });
});

describe('metaFromHead', () => {
  const now = 1_000_000_000_000;
  it('prefers the title over the first user message', () => {
    const m = metaFromHead('id', 5, { title: 'T', firstUser: 'hello', count: 3 }, now);
    expect(m.title).toBe('T');
    expect(m.snippet).toBe('hello');
    expect(m.count).toBe(3);
    expect(m.mtime).toBe(5);
  });
  it('falls back to a truncated first user message when title is blank', () => {
    const long = 'x'.repeat(100);
    const m = metaFromHead('id', 5, { title: '', firstUser: long, count: 0 }, now);
    expect(m.title).toBe('x'.repeat(60));
    expect(m.snippet).toBe('x'.repeat(100));
  });
  it('falls back to "Sem título" with empty snippet when nothing is present', () => {
    const m = metaFromHead('id', 5, { title: '', count: 0 }, now);
    expect(m.title).toBe('Sem título');
    expect(m.snippet).toBe('');
  });
});

describe('metaForId slug guard', () => {
  it('rejects ids that are not a canonical UUID before touching disk', async () => {
    const bad = [
      '../etc/passwd',
      'a/b',
      '123456789012345678901234567890123456',
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      `${VALID}.jsonl`,
      '',
    ];
    for (const id of bad) expect(await metaForId(id)).toBeNull();
  });

  it('returns null for a canonical UUID that has no file', async () => {
    expect(await metaForId(VALID)).toBeNull();
  });
});
