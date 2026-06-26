import { describe, it, expect } from 'vitest';
import { fileSig, isFreshUpload, pickFreshUploads } from './dedupe-uploads';

const f = (name: string, size: number) => ({ name, size });

describe('fileSig', () => {
  it('ignora lastModified (cópias do mesmo arquivo com data jitterada batem)', () => {
    expect(fileSig({ name: 'image.png', size: 2048, lastModified: 1 } as never))
      .toBe(fileSig({ name: 'image.png', size: 2048, lastModified: 999 } as never));
  });
  it('distingue por tamanho', () => {
    expect(fileSig(f('image.png', 2048))).not.toBe(fileSig(f('image.png', 4096)));
  });
});

describe('isFreshUpload', () => {
  it('aceita o primeiro e barra a repetição dentro da janela', () => {
    const seen = new Map<string, number>();
    expect(isFreshUpload(seen, 'image.png:2048', 0)).toBe(true);
    expect(isFreshUpload(seen, 'image.png:2048', 500)).toBe(false);
    expect(isFreshUpload(seen, 'image.png:2048', 2999)).toBe(false);
  });
  it('libera de novo depois da janela', () => {
    const seen = new Map<string, number>();
    expect(isFreshUpload(seen, 'image.png:2048', 0)).toBe(true);
    expect(isFreshUpload(seen, 'image.png:2048', 3000)).toBe(true);
  });
});

describe('pickFreshUploads', () => {
  it('colapsa o mesmo arquivo repetido para um só', () => {
    const img = f('image.png', 2048);
    const out = pickFreshUploads([img, img, img, img], new Map(), 0);
    expect(out).toHaveLength(1);
  });
  it('mantém arquivos diferentes (multi-anexo legítimo)', () => {
    const out = pickFreshUploads([f('a.png', 10), f('b.png', 20), f('c.png', 10)], new Map(), 0);
    expect(out).toHaveLength(3);
  });
  it('deduplica entre chamadas dentro da janela', () => {
    const img = f('image.png', 2048);
    const seen = new Map<string, number>();
    expect(pickFreshUploads([img], seen, 0)).toHaveLength(1);
    expect(pickFreshUploads([img], seen, 500)).toHaveLength(0);
  });
});
