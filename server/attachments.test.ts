import { describe, it, expect } from 'vitest';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { safeSeg, saveAttachment, readAttachment } from './attachments';
import { CONFIG } from './config';

describe('safeSeg', () => {
  it('strips directory traversal down to the basename', () => {
    expect(safeSeg('../../etc/passwd', 80, 'file')).toBe('passwd');
    expect(safeSeg('/abs/path/secret.txt', 80, 'file')).toBe('secret.txt');
  });

  it('replaces unsafe characters with underscores', () => {
    expect(safeSeg('a b;rm -rf$(x).png', 80, 'file')).toBe('a_b_rm_-rf__x_.png');
  });

  it('drops leading dots so dotfiles cannot be forged', () => {
    expect(safeSeg('...hidden', 80, 'file')).toBe('hidden');
  });

  it('truncates to the max length', () => {
    expect(safeSeg('x'.repeat(200), 10, 'file')).toBe('x'.repeat(10));
  });

  it('falls back when sanitizing leaves nothing', () => {
    expect(safeSeg('../', 80, 'fallback')).toBe('fallback');
    expect(safeSeg('', 80, 'fallback')).toBe('fallback');
  });
});

describe('saveAttachment', () => {
  it('rejects an empty file before touching disk', async () => {
    expect(await saveAttachment('s', 'x.txt', '')).toEqual({ error: 'arquivo vazio' });
  });

  it('rejects non-string fields before decoding (raw WS frame is untyped)', async () => {
    const bad = { error: 'anexo inválido' };
    expect(await saveAttachment(1 as unknown as string, 'x.txt', 'aGk=')).toEqual(bad);
    expect(await saveAttachment('s', null as unknown as string, 'aGk=')).toEqual(bad);
    expect(await saveAttachment('s', 'x.txt', 42 as unknown as string)).toEqual(bad);
    expect(await saveAttachment('s', 'x.txt', { b: 1 } as unknown as string)).toEqual(bad);
  });
});

describe('readAttachment', () => {
  it('rejects traversal and paths outside attachments/', async () => {
    const bad = { error: 'anexo inválido' };
    expect(await readAttachment('attachments/../secret')).toEqual(bad);
    expect(await readAttachment('/etc/passwd')).toEqual(bad);
    expect(await readAttachment('other/place/file.png')).toEqual(bad);
    expect(await readAttachment(42 as unknown as string)).toEqual(bad);
  });

  it('reports unavailable when the file is gone (TTL sweep)', async () => {
    expect(await readAttachment('attachments/nope/zzz-aaaa0000-x.png')).toEqual({
      error: 'anexo indisponível (expirado?)',
    });
  });

  it('round-trips a saved attachment and strips the disk prefix from the name', async () => {
    const dataB64 = Buffer.from('conteudo de teste').toString('base64');
    const saved = await saveAttachment('vitest-read', 'foto teste.png', dataB64);
    expect('path' in saved).toBe(true);
    if (!('path' in saved)) return;
    try {
      const r = await readAttachment(saved.path);
      expect(r).toEqual({ name: 'foto_teste.png', dataB64 });
    } finally {
      await rm(resolve(CONFIG.workdir, 'attachments', 'vitest-read'), { recursive: true, force: true });
    }
  });
});
