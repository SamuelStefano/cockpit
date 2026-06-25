import { describe, it, expect } from 'vitest';
import { fileSig, pickFreshUploads } from './dedupe-uploads';

const f = (name: string, size: number, lastModified = 100): { name: string; size: number; lastModified: number } =>
  ({ name, size, lastModified });

describe('pickFreshUploads', () => {
  it('colapsa o mesmo arquivo repetido no FileList (bug iOS) para um só', () => {
    const img = f('image.png', 2048);
    const seen = new Map<string, number>();
    const out = pickFreshUploads([img, img, img, img], seen, 0);
    expect(out).toHaveLength(1);
  });

  it('mantém arquivos diferentes (multi-anexo legítimo)', () => {
    const seen = new Map<string, number>();
    const out = pickFreshUploads([f('a.png', 10), f('b.png', 20), f('c.png', 10)], seen, 0);
    expect(out).toHaveLength(3);
  });

  it('deduplica entre chamadas dentro da janela (re-disparo do change)', () => {
    const img = f('image.png', 2048);
    const seen = new Map<string, number>();
    expect(pickFreshUploads([img], seen, 0)).toHaveLength(1);
    expect(pickFreshUploads([img], seen, 500)).toHaveLength(0);
  });

  it('libera o mesmo arquivo depois da janela', () => {
    const img = f('image.png', 2048);
    const seen = new Map<string, number>();
    expect(pickFreshUploads([img], seen, 0)).toHaveLength(1);
    expect(pickFreshUploads([img], seen, 3000)).toHaveLength(1);
  });

  it('distingue por tamanho e data (mesmo nome, arquivos diferentes)', () => {
    const seen = new Map<string, number>();
    const out = pickFreshUploads([f('image.png', 2048, 1), f('image.png', 4096, 2)], seen, 0);
    expect(out).toHaveLength(2);
    expect(fileSig(f('image.png', 2048, 1))).not.toBe(fileSig(f('image.png', 4096, 2)));
  });
});
