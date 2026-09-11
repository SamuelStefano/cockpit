import { describe, it, expect, vi } from 'vitest';
import { digestFile, rememberSent, markDuplicates, MAX_DIGEST_BYTES } from './sent-attachments';

describe('digestFile', () => {
  it('same content gives the same digest regardless of name', async () => {
    const a = await digestFile(new File(['print'], 'image.png'));
    const b = await digestFile(new File(['print'], 'outro.png'));
    const c = await digestFile(new File(['outro print'], 'image.png'));
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('skips files above the digest cap without reading them', async () => {
    const arrayBuffer = vi.fn();
    const huge = { size: MAX_DIGEST_BYTES + 1, arrayBuffer } as unknown as Blob;
    expect(await digestFile(huge)).toBeUndefined();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});

describe('rememberSent', () => {
  it('stores hashes per session without duplicates', () => {
    const s = rememberSent(rememberSent({}, 's1', ['h1', 'h2']), 's1', ['h2', 'h3']);
    expect(s.s1).toEqual(['h1', 'h2', 'h3']);
  });

  it('ignores empty hashes and returns the same object when nothing changes', () => {
    const base = { s1: ['h1'] };
    expect(rememberSent(base, 's1', ['', ''])).toBe(base);
  });

  it('caps the number of sessions, dropping the least recently touched', () => {
    let s = {};
    for (let i = 0; i < 45; i++) s = rememberSent(s, `s${i}`, [`h${i}`]);
    s = rememberSent(s, 's0', ['again']);
    const keys = Object.keys(s);
    expect(keys).toHaveLength(40);
    expect(keys.at(-1)).toBe('s0');
    expect(keys).not.toContain('s1');
  });
});

describe('markDuplicates', () => {
  it('flags attachments already sent in the session and repeats inside the composer', () => {
    const out = markDuplicates(
      [{ path: 'a', hash: 'x' }, { path: 'b', hash: 'y' }, { path: 'c', hash: 'y' }, { path: 'd' }],
      ['x'],
    );
    expect(out.map((a) => a.dup)).toEqual(['sent', undefined, 'composer', undefined]);
  });
});
